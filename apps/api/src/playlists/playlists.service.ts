import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { assertFound, assertOwnerShip } from '../common/utils/ownership.utils';
import { gradeAtAngle, resolveAngleId } from '../common/utils/angle.utils';
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
import { PlaylistBoulder } from '../generated/prisma/client';

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
          // Ordre explicite : sans `orderBy`, PostgreSQL ne garantit rien et
          // la liste pouvait se réordonner d'un appel à l'autre. Les blocs
          // positionnés d'abord, puis les plus récemment ajoutés.
          orderBy: [
            { position: { sort: 'asc', nulls: 'last' } },
            { addedAt: 'desc' },
          ],
          include: {
            // L'inclinaison de l'entrée, pas celle du bloc (son créateur).
            angle: { select: { valueDegrees: true } },
            boulder: {
              select: {
                name: true,
                angleId: true,
                grade: {
                  select: { vScale: true, rank: true, fontScale: true },
                },
              },
            },
          },
        },
      },
    });

    assertFound(playlist, 'Playlist');
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
      boulders: playlist.playlistBoulders.map((pb) => {
        const grade = gradeAtAngle(pb.boulder, pb.angleId);
        return {
          position: pb.position,
          addedAt: pb.addedAt,
          boulder: {
            id: pb.boulderId,
            name: pb.boulder.name,
            vScale: grade?.vScale ?? null,
            fontScale: grade?.fontScale ?? null,
            angleDegrees: pb.angle.valueDegrees,
          },
        };
      }),
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

  /**
   * Playlists de l'utilisateur. Avec `forBoulder`, chacune indique en plus si
   * elle contient déjà ce bloc à cette inclinaison (`containsBoulder`).
   *
   * Sans cette information, l'écran « Add to playlist » ne pourrait que tenter
   * l'ajout et découvrir le doublon par un 409 : l'utilisateur doit voir
   * d'avance où le bloc se trouve, et pouvoir l'en retirer.
   */
  async findMine(
    user: JwtPayload,
    forBoulder?: { boulderId: number; angleDegrees: number },
  ): Promise<PlaylistSummaryDto[]> {
    const playlists = await this.prisma.playlist.findMany({
      where: {
        userId: user.userId,
      },
      include: {
        user: { select: { username: true } },
        _count: { select: { playlistBoulders: true } },
        // Relation filtrée sur le seul bloc demandé, à l'inclinaison demandée :
        // zéro ou une ligne par playlist, la clé (bloc, playlist, inclinaison)
        // étant unique. `false` quand aucun bloc n'est demandé — la relation
        // n'est alors pas chargée du tout. Une inclinaison inconnue ne trouve
        // simplement rien : la coche est vide, comme pour `isLiked`.
        playlistBoulders:
          forBoulder === undefined
            ? false
            : {
                where: {
                  boulderId: forBoulder.boulderId,
                  angle: { valueDegrees: forBoulder.angleDegrees },
                },
                select: { boulderId: true },
              },
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
      ...(forBoulder !== undefined && {
        containsBoulder: (p.playlistBoulders ?? []).length > 0,
      }),
    }));
  }

  async removePlaylist(user: JwtPayload, id: number): Promise<void> {
    const playlist = await this.prisma.playlist.findUnique({ where: { id } });
    assertFound(playlist, 'Playlist');
    assertOwnerShip(playlist, user.userId);

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

    assertFound(playlist, 'Playlist');
    assertOwnerShip(playlist, user.userId);

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

  async addBoulder(
    user: JwtPayload,
    dto: AddBoulderDto,
    playlistId: number,
  ): Promise<PlaylistBoulder> {
    const playlist = await this.prisma.playlist.findUnique({
      where: {
        id: playlistId,
      },
    });

    assertFound(playlist, 'Playlist');
    assertOwnerShip(playlist, user.userId);

    const boulder = await this.prisma.boulder.findUnique({
      where: { id: dto.boulderId },
    });

    assertFound(boulder, 'Boulder');
    const angleId = await resolveAngleId(this.prisma, dto.angleDegrees);

    // Doublon = même bloc à la même inclinaison. Le même bloc à une autre
    // inclinaison est une autre entrée.
    const existing = await this.prisma.playlistBoulder.findUnique({
      where: {
        boulderId_playlistId_angleId: {
          boulderId: dto.boulderId,
          playlistId,
          angleId,
        },
      },
    });
    if (existing) throw new ConflictException('Boulder already in playlist');

    const playlistBoulder = await this.prisma.playlistBoulder.create({
      data: {
        boulderId: dto.boulderId,
        playlistId,
        angleId,
        position: dto.position,
      },
    });

    return playlistBoulder;
  }

  async removeBoulder(
    user: JwtPayload,
    boulderId: number,
    playlistId: number,
    angleDegrees: number,
  ): Promise<void> {
    const playlist = await this.prisma.playlist.findUnique({
      where: {
        id: playlistId,
      },
    });
    assertFound(playlist, 'Playlist');
    assertOwnerShip(playlist, user.userId);
    const boulder = await this.prisma.boulder.findUnique({
      where: { id: boulderId },
    });

    assertFound(boulder, 'Boulder');
    const angleId = await resolveAngleId(this.prisma, angleDegrees);

    await this.prisma.playlistBoulder.delete({
      where: {
        boulderId_playlistId_angleId: { boulderId, playlistId, angleId },
      },
    });
  }
}
