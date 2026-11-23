import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { assertFound } from '../common/utils/ownership.utils';
import { getPaginationParams } from '../common/utils/pagination.utils';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { BoulderStatus } from '../generated/prisma/client';
import { MyBoulderDto } from './dto/my-boulder.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Les compteurs sont ceux exposés par getPublicProfile : sans eux, un
  // utilisateur verrait des statistiques sur le profil des autres mais pas sur
  // le sien. Une seule forme de profil, quel que soit celui qu'on regarde.
  private readonly profileCounts = {
    _count: {
      select: {
        followedBy: true,
        follows: true,
        boulders: true,
        ascents: true,
      },
    },
  } as const;

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true, xpPoints: true, level: true },
      include: this.profileCounts,
    });

    // 401 et non 404 : l'identifiant vient du token, pas du client. Un jeton
    // valide qui ne désigne aucun compte (supprimé, base restaurée) est un
    // problème d'authentification — le client doit se déconnecter, pas
    // afficher « introuvable ». C'est ce que faisait GET /auth/me, dont cette
    // route reprend le rôle ; le perdre ferait boucler le mobile, qui ne
    // réagit qu'au 401.
    if (!user) {
      throw new UnauthorizedException("Token payload doesn't match any user");
    }

    return user;
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      omit: { passwordHash: true, xpPoints: true, level: true },
    });
  }

  async getPublicProfile(username: string, viewerId: number) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      // email et role en plus : cette route est consultable par n'importe quel
      // compte authentifié, à partir du seul username. Sans ces omissions,
      // elle sert un annuaire d'adresses doublé de la liste des comptes ADMIN
      // — soit une liste de cibles prioritaires pour qui cherche à s'infiltrer.
      // Les omissions sont INCONDITIONNELLES : un profil public ne rend jamais
      // ces champs, même le sien. On lit les siens par GET /users/me. Une
      // règle sans exception ne peut pas être mal appliquée.
      omit: {
        passwordHash: true,
        xpPoints: true,
        level: true,
        email: true,
        role: true,
      },
      include: this.profileCounts,
    });

    assertFound(user, 'User');
    // Le réglage de confidentialité protège des autres, pas de soi-même :
    // atteindre son propre profil par son username (lien profond, retour de
    // recherche) ne doit pas se solder par un 403.
    if (!user.isPublic && user.id !== viewerId) {
      throw new ForbiddenException('This profile is private');
    }

    return user;
  }

  async follow(followerId: number, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    assertFound(target, 'User');
    if (target.id === followerId) {
      throw new ConflictException('You cannot follow yourself');
    }

    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: target.id,
        },
      },
    });

    if (existing) throw new ConflictException('Already following this user');

    return await this.prisma.userFollow.create({
      data: { followerId, followingId: target.id },
    });
  }

  async unfollow(followerId: number, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    assertFound(target, 'User');

    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: target.id,
        },
      },
    });

    if (!existing)
      throw new NotFoundException('You are not following this user');

    return await this.prisma.userFollow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: target.id,
        },
      },
    });
  }

  async getMyProjects(userId: number) {
    return this.prisma.ascent.findMany({
      where: { userId, status: 'PROJECT' },
      include: {
        // Un projet est ouvert À une inclinaison ; `boulder.angle` n'est que
        // celle de la création du bloc.
        angle: { select: { valueDegrees: true } },
        boulder: {
          select: {
            name: true,
            angle: { select: { valueDegrees: true } },
          },
        },
        // Cotation effective à l'inclinaison du projet, et non celle du
        // créateur : `boulder.grade` n'est volontairement pas exposé ici.
        boulderAngle: {
          select: {
            grade: { select: { vScale: true, fontScale: true, rank: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Mes blocs publiés, du plus récent au plus ancien, chacun à son
   * inclinaison de création. Les brouillons ont leur liste (Library).
   */
  async getMyBoulders(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<MyBoulderDto>> {
    const where = { creatorId: userId, status: BoulderStatus.PUBLIC };
    const { skip, take, page, limit } = getPaginationParams(
      query.page,
      query.limit,
    );

    const [boulders, total] = await Promise.all([
      this.prisma.boulder.findMany({
        where,
        select: {
          id: true,
          name: true,
          createdAt: true,
          angleId: true,
          angle: { select: { valueDegrees: true } },
          // Toutes les inclinaisons : Prisma ne sait pas filtrer une relation
          // sur une colonne du parent (`angle_id`). Une page de 20 blocs en
          // lit environ 220 lignes, filtrées ci-dessous.
          boulderAngles: {
            select: { angleId: true, grade: { select: { rank: true } } },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.boulder.count({ where }),
    ]);

    return {
      data: boulders.map((b) => ({
        id: b.id,
        name: b.name,
        angleDegrees: b.angle.valueDegrees,
        // Non nulle : la cotation de départ est posée à la création, à cette
        // inclinaison.
        gradeRank: b.boulderAngles.find((ba) => ba.angleId === b.angleId)?.grade
          ?.rank as number,
        createdAt: b.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
