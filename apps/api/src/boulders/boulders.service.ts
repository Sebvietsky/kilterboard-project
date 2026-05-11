import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import {
  BoulderDetailDto,
  BoulderSummaryDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class BouldersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterBoulderDto): Promise<BoulderSummaryDto[]> {
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

    const boulders = await this.prisma.boulder.findMany({
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
      orderBy: {
        ascents: { _count: 'desc' },
      },
    });

    return boulders.map((boulder) => ({
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
    }));
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

    if (!boulder) throw new NotFoundException('Boulder not found');

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
    if (!boulder) throw new NotFoundException('Boulder not found');

    if (boulder.creatorId !== userId) throw new ForbiddenException();

    await this.prisma.boulder.update({
      where: { id },
      data: { isDraft: false, isPublic: true },
    });
  }
}
