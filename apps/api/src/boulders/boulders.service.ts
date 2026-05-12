import { Injectable } from '@nestjs/common';
import { assertFound, assertOwnerShip } from '../common/utils/ownership.utils';
import { PrismaService } from '../prisma/prisma.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import {
  BoulderDetailDto,
  BoulderSummaryDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';
import { Prisma } from '../generated/prisma/client';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { getPaginationParams } from '../common/utils/pagination.utils';

@Injectable()
export class BouldersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: FilterBoulderDto,
  ): Promise<PaginatedResponse<BoulderSummaryDto>> {
    const where: Prisma.BoulderWhereInput = {
      isPublic: true,
      isDraft: false,
      ...(filters.angle && {
        angle: { valueDegrees: filters.angle },
      }),
      ...((filters.gradeMin ?? filters.gradeMax) && {
        grade: {
          rank: {
            ...(filters.gradeMin && { gte: filters.gradeMin }),
            ...(filters.gradeMax && { lte: filters.gradeMax }),
          },
        },
      }),
      ...(filters.name && {
        name: { contains: filters.name, mode: 'insensitive' },
      }),
      ...(filters.creator && {
        creator: {
          username: { contains: filters.creator, mode: 'insensitive' },
        },
      }),
      ...(filters.tags?.length && {
        AND: filters.tags.map((slug) => ({
          boulderTags: {
            some: { tag: { slug } },
          },
        })),
      }),
    };
    const { skip, take, page, limit } = getPaginationParams(
      filters.page,
      filters.limit,
    );

    const [boulders, total] = await Promise.all([
      this.prisma.boulder.findMany({
        where,
        include: {
          grade: { select: { vScale: true, fontScale: true, rank: true } },
          creator: { select: { username: true } },
          angle: { select: { valueDegrees: true } },
          boulderTags: {
            select: { tag: { select: { name: true, slug: true } } },
          },
          _count: { select: { ascents: true } },
        },
        skip,
        take,
        orderBy: {
          ascents: { _count: 'desc' },
        },
      }),
      this.prisma.boulder.count({ where }),
    ]);

    return {
      data: boulders.map((boulder) => ({
        id: boulder.id,
        name: boulder.name,
        gradeLabel: boulder.grade.vScale,
        gradeRank: boulder.grade.rank,
        angleDegrees: boulder.angle.valueDegrees,
        creatorUsername: boulder.creator.username,
        tags: boulder.boulderTags.map((bt) => bt.tag.slug),
        ascentCount: boulder._count.ascents,
        averageRating: null,
        isPublic: boulder.isPublic,
        createdAt: boulder.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number): Promise<BoulderDetailDto> {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id, isPublic: true, isDraft: false },
      include: {
        grade: { select: { vScale: true, fontScale: true, rank: true } },
        creator: { select: { username: true } },
        angle: { select: { valueDegrees: true } },
        boulderTags: {
          select: { tag: { select: { name: true, slug: true } } },
        },
        boulderHolds: {
          select: {
            role: true,
            hold: { select: { holdCode: true, x: true, y: true } },
          },
        },
        _count: { select: { ascents: true } },
      },
    });

    assertFound(boulder, 'Boulder');

    const publicNotes = await this.findComments(id);

    const ratings = await this.prisma.ascent.aggregate({
      where: { boulderId: id, rating: { not: null } },
      _avg: { rating: true },
    });

    return {
      id: boulder.id,
      name: boulder.name,
      gradeLabel: boulder.grade.vScale,
      gradeRank: boulder.grade.rank,
      angleDegrees: boulder.angle.valueDegrees,
      creatorUsername: boulder.creator.username,
      tags: boulder.boulderTags.map((bt) => bt.tag.slug),
      ascentCount: boulder._count.ascents,
      averageRating: ratings._avg.rating,
      isPublic: boulder.isPublic,
      createdAt: boulder.createdAt,
      description: boulder.description,
      holds: boulder.boulderHolds.map((bh) => ({
        holdCode: bh.hold.holdCode,
        x: bh.hold.x,
        y: bh.hold.y,
        role: bh.role,
      })),
      publicNotes,
    };
  }

  async findComments(boulderId: number): Promise<PublicNoteDto[]> {
    const notes = await this.prisma.ascentNote.findMany({
      where: {
        boulderId,
        visibility: 'PUBLIC',
      },
      include: {
        user: { select: { username: true, avatarUrl: true } },
        ascent: {
          select: {
            feltGrade: { select: { vScale: true } },
          },
        },
        _count: { select: { ascentNoteLikes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => ({
      username: note.user.username,
      avatarUrl: note.user.avatarUrl,
      content: note.content,
      feltGradeLabel: note.ascent.feltGrade?.vScale ?? null,
      likesCount: note._count.ascentNoteLikes,
      createdAt: note.createdAt,
    }));
  }

  async publishBoulder(id: number, userId: number): Promise<void> {
    const boulder = await this.prisma.boulder.findUnique({ where: { id } });
    assertFound(boulder, 'Boulder');

    // Boulder uses creatorId instead of userId
    assertOwnerShip({ userId: boulder.creatorId }, userId);

    await this.prisma.boulder.update({
      where: { id },
      data: { isDraft: false, isPublic: true },
    });
  }
}
