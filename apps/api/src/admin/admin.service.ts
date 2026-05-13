import { Injectable } from '@nestjs/common';
import { assertFound } from '../common/utils/ownership.utils';
import { PrismaService } from '../prisma/prisma.service';
import { Boulder, Prisma } from '../generated/prisma/client';
import { AdminQueryDto } from './dto/admin-query.dto';
import {
  AdminUserResult,
  AdminBoulderResult,
  AdminPlaylistResult,
} from './dto/admin-responst.types';
import {
  getPaginationParams,
  getSafeOrderBy,
} from '../common/utils/pagination.utils';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly ALLOWED_USER_ORDER_BY = [
    'createdAt',
    'username',
    'email',
    'role',
    'country',
  ] as const;
  private readonly ALLOWED_BOULDER_ORDER_BY = [
    'createdAt',
    'name',
    'isPublic',
    'isDraft',
  ] as const;
  private readonly ALLOWED_PLAYLIST_ORDER_BY = [
    'createdAt',
    'name',
    'isPublic',
  ] as const;

  async findAllUsers(query: AdminQueryDto): Promise<AdminUserResult[]> {
    const where: Prisma.UserWhereInput = {
      ...(query?.role && { role: query.role }),
      ...(query?.search && {
        username: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const { skip, take } = getPaginationParams(query.page, query.limit);
    const orderField = getSafeOrderBy(
      this.ALLOWED_USER_ORDER_BY,
      query.orderBy,
      'createdAt',
    );

    return await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        country: true,
        isPublic: true,
        createdAt: true,
        _count: {
          select: { ascents: true, boulders: true, followedBy: true },
        },
      },
      skip,
      take,
      orderBy: { [orderField]: query.order ?? 'desc' },
    });
  }

  async findAllBoulders(query: AdminQueryDto): Promise<AdminBoulderResult[]> {
    const where: Prisma.BoulderWhereInput = {
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.isPublic !== undefined && { isPublic: query.isPublic }),
    };

    const { skip, take } = getPaginationParams(query.page, query.limit);
    const orderField = getSafeOrderBy(
      this.ALLOWED_BOULDER_ORDER_BY,
      query.orderBy,
      'createdAt',
    );

    return await this.prisma.boulder.findMany({
      where,
      include: {
        creator: { select: { username: true } },
        grade: { select: { vScale: true, rank: true } },
        _count: { select: { ascents: true } },
      },
      skip,
      take,
      orderBy: { [orderField]: query.order ?? 'desc' },
    });
  }

  async findAllPlaylists(query: AdminQueryDto): Promise<AdminPlaylistResult[]> {
    const where: Prisma.PlaylistWhereInput = {
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.isPublic !== undefined && { isPublic: query.isPublic }),
    };

    const { skip, take } = getPaginationParams(query.page, query.limit);
    const orderField = getSafeOrderBy(
      this.ALLOWED_PLAYLIST_ORDER_BY,
      query.orderBy,
      'createdAt',
    );

    return await this.prisma.playlist.findMany({
      where,
      include: {
        user: { select: { username: true } },
        _count: { select: { playlistBoulders: true } },
      },
      skip,
      take,
      orderBy: { [orderField]: query.order ?? 'desc' },
    });
  }

  async deleteBoulder(id: number): Promise<void> {
    const boulder: Boulder | null = await this.prisma.boulder.findUnique({
      where: { id },
    });
    assertFound(boulder, 'Boulder');
    await this.prisma.boulder.delete({ where: { id } });
  }
}
