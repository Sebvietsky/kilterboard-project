import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { AdminQueryDto } from './dto/admin-query.dto';
import {
  AdminUserResult,
  AdminBoulderResult,
  AdminPlaylistResult,
} from './dto/admin-responst.types';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllUsers(query: AdminQueryDto): Promise<AdminUserResult[]> {
    const where: Prisma.UserWhereInput = {
      ...(query?.role && { role: query.role }),
      ...(query?.search && {
        username: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    return await this.prisma.user.findMany({
      where,
      omit: { passwordHash: true },
      include: {
        _count: {
          select: { ascents: true, boulders: true, followedBy: true },
        },
      },
      skip,
      take: limit,
      orderBy: { [query.orderBy ?? 'createdAt']: query.order ?? 'desc' },
    });
  }

  async findAllBoulders(query: AdminQueryDto): Promise<AdminBoulderResult[]> {
    const where: Prisma.BoulderWhereInput = {
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.isPublic !== undefined && { isPublic: query.isPublic }),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    return await this.prisma.boulder.findMany({
      where,
      include: {
        creator: { select: { username: true } },
        grade: { select: { vScale: true, rank: true } },
        _count: { select: { ascents: true } },
      },
      skip,
      take: limit,
      orderBy: { [query.orderBy ?? 'createdAt']: query.order ?? 'desc' },
    });
  }

  async findAllPlaylists(query: AdminQueryDto): Promise<AdminPlaylistResult[]> {
    const where: Prisma.PlaylistWhereInput = {
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.isPublic !== undefined && { isPublic: query.isPublic }),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    return this.prisma.playlist.findMany({
      where,
      include: {
        user: { select: { username: true } },
        _count: { select: { playlistBoulders: true } },
      },
      skip,
      take: limit,
      orderBy: { [query.orderBy ?? 'createdAt']: query.order ?? 'desc' },
    });
  }

  async deleteBoulder(id: number): Promise<void> {
    const boulder = await this.prisma.boulder.findUnique({ where: { id } });
    if (!boulder) throw new NotFoundException('Boulder not found');
    await this.prisma.boulder.delete({ where: { id } });
  }
}
