import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';
import {
  PlaylistDetailDto,
  PlaylistResponseDto,
  PlaylistSummaryDto,
} from './dto/playlist-response.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddBoulderDto } from './dto/add-boulder.dto';

@Injectable()
export class PlaylistsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    playlistId: number,
    user: JwtPayload,
  ): Promise<PlaylistDetailDto> {
    const playlist = await this.prisma.playlist.findUnique({
      where: {
        id: playlistId,
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
        _count: { select: { playlistBoulders: true } },
        playlistBoulders: {
          include: {
            boulder: {
              select: {
                name: true,
                grade: {
                  select: { vScale: true, rank: true, fontScale: true },
                },
                angle: { select: { valueDegrees: true } },
              },
            },
          },
        },
      },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    if (!playlist.isPublic && playlist.userId !== user.userId) {
      throw new ForbiddenException();
    }

    return {
      id: playlist.id,
      userId: playlist.userId,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      creatorUsername: playlist.user.username,
      boulderCount: playlist._count.playlistBoulders,
      createdAt: playlist.createdAt,
      boulders: playlist.playlistBoulders.map((pb) => ({
        position: pb.position,
        addedAt: pb.addedAt,
        boulder: {
          id: pb.boulderId,
          name: pb.boulder.name,
          vScale: pb.boulder.grade.vScale,
          fontScale: pb.boulder.grade.fontScale,
          angleDegrees: pb.boulder.angle.valueDegrees,
        },
      })),
    };
  }

  async createPlaylist(
    dto: CreatePlaylistDto,
    userId: number,
  ): Promise<PlaylistResponseDto> {
    const playlist = await this.prisma.playlist.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        isPublic: dto.isPublic ?? false,
        userId,
      },
      omit: { userId: true },
    });

    return playlist;
  }

  async findMine(user: JwtPayload): Promise<PlaylistSummaryDto[]> {
    const playlists = await this.prisma.playlist.findMany({
      where: {
        userId: user.userId,
      },
      include: {
        user: { select: { username: true } },
        _count: { select: { playlistBoulders: true } },
      },
    });

    return playlists.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      description: p.description,
      isPublic: p.isPublic,
      creatorUsername: p.user.username,
      boulderCount: p._count.playlistBoulders,
      createdAt: p.createdAt,
    }));
  }

  async removePlaylist(user: JwtPayload, id: number) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== user.userId) throw new ForbiddenException();

    await this.prisma.playlist.delete({ where: { id } });
  }

  async update(
    dto: UpdatePlaylistDto,
    user: JwtPayload,
    id: number,
  ): Promise<PlaylistResponseDto> {
    const playlist = await this.prisma.playlist.findUnique({
      where: {
        id,
      },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== user.userId) throw new ForbiddenException();

    const updatedPlaylist = await this.prisma.playlist.update({
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
      },
      where: { id },
      omit: { userId: true },
    });

    return updatedPlaylist;
  }

  async addBoulder(user: JwtPayload, dto: AddBoulderDto, playlistId: number) {
    const playlist = await this.prisma.playlist.findUnique({
      where: {
        id: playlistId,
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== user.userId)
      throw new ForbiddenException('You need to be the owner of this playlist');
    const boulder = await this.prisma.boulder.findUnique({
      where: { id: dto.boulderId },
    });

    if (!boulder) {
      throw new NotFoundException('Boulder not found');
    }

    const existing = await this.prisma.playlistBoulder.findUnique({
      where: { boulderId_playlistId: { boulderId: dto.boulderId, playlistId } },
    });
    if (existing) throw new ConflictException('Boulder already in playlist');

    const playlistBoulder = await this.prisma.playlistBoulder.create({
      data: {
        boulderId: dto.boulderId,
        playlistId,
        position: dto.position,
      },
    });

    return playlistBoulder;
  }
  async removeBoulder(
    user: JwtPayload,
    boulderId: number,
    playlistId: number,
  ): Promise<void> {
    const playlist = await this.prisma.playlist.findUnique({
      where: {
        id: playlistId,
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== user.userId)
      throw new ForbiddenException('You need to be the owner of this playlist');
    const boulder = await this.prisma.boulder.findUnique({
      where: { id: boulderId },
    });

    if (!boulder) {
      throw new NotFoundException('Boulder not found');
    }

    await this.prisma.playlistBoulder.delete({
      where: { boulderId_playlistId: { boulderId, playlistId } },
    });
  }
}
