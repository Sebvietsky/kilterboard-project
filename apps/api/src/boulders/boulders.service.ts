import { Injectable } from '@nestjs/common';
import { assertFound, assertOwnerShip } from '../common/utils/ownership.utils';
import { PrismaService } from '../prisma/prisma.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import {
  BoulderDetailDto,
  BoulderLikeStatusDto,
  BoulderSummaryDto,
  LikedBoulderDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';
import { Prisma } from '../generated/prisma/client';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { getPaginationParams } from '../common/utils/pagination.utils';
import { resolveAngleId } from '../common/utils/angle.utils';
import { isEstimatedGrade } from './community-grade';

@Injectable()
export class BouldersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catalogue d'Explore, toujours à une inclinaison (décision du 2026-11-06) :
   * une carte = un bloc à cette inclinaison. La requête part donc de
   * `boulder_angles`, une ligne par bloc et par inclinaison.
   *
   * - Un bloc n'apparaît que s'il est coté à cette inclinaison (décision du
   *   2026-10-15) : cotation de départ (créateur, Kilter) ou votes.
   * - La cotation, le nombre d'ascensions et la note sont ceux de cette
   *   inclinaison, comme le filtre de cotation.
   * - Tri : popularité Kilter à cette inclinaison (`kilter_ascensionists`,
   *   0 pour un bloc créé dans l'app, qui passe donc après), puis nos
   *   ascensions à cette inclinaison.
   */
  async findAll(
    filters: FilterBoulderDto,
  ): Promise<PaginatedResponse<BoulderSummaryDto>> {
    const angleId = await resolveAngleId(this.prisma, filters.angle);
    const where: Prisma.BoulderAngleWhereInput = {
      angleId,
      gradeId: { not: null },
      ...((filters.gradeMin ?? filters.gradeMax) && {
        grade: {
          rank: {
            ...(filters.gradeMin && { gte: filters.gradeMin }),
            ...(filters.gradeMax && { lte: filters.gradeMax }),
          },
        },
      }),
      boulder: {
        isPublic: true,
        isDraft: false,
        ...(filters.name && {
          name: { contains: filters.name, mode: 'insensitive' },
        }),
        // Le créateur d'un bloc importé est son setter Kilter, pas le compte
        // système qui le porte en base.
        ...(filters.creator && {
          OR: [
            {
              creator: {
                username: { contains: filters.creator, mode: 'insensitive' },
              },
            },
            { setterName: { contains: filters.creator, mode: 'insensitive' } },
          ],
        }),
        ...(filters.tags?.length && {
          AND: filters.tags.map((slug) => ({
            boulderTags: {
              some: { tag: { slug } },
            },
          })),
        }),
      },
    };
    const { skip, take, page, limit } = getPaginationParams(
      filters.page,
      filters.limit,
    );

    const [rows, total] = await Promise.all([
      this.prisma.boulderAngle.findMany({
        where,
        include: {
          grade: { select: { rank: true } },
          _count: { select: { ascents: true } },
          kilterStats: {
            select: { ascensionistCount: true, qualityAverage: true },
          },
          boulder: {
            include: {
              creator: { select: { username: true } },
              boulderTags: {
                select: { tag: { select: { name: true, slug: true } } },
              },
            },
          },
        },
        skip,
        take,
        orderBy: [
          { kilterAscensionists: 'desc' },
          { ascents: { _count: 'desc' } },
          { boulderId: 'asc' },
        ],
      }),
      this.prisma.boulderAngle.count({ where }),
    ]);

    const ratings = await this.prisma.ascent.groupBy({
      by: ['boulderId'],
      where: {
        boulderId: { in: rows.map((row) => row.boulderId) },
        angleId,
        rating: { not: null },
      },
      _avg: { rating: true },
    });

    const ratingByBoulder = new Map(
      ratings.map((r) => [r.boulderId, r._avg.rating]),
    );

    return {
      data: rows.map(({ boulder, grade, _count, kilterStats }) => ({
        id: boulder.id,
        name: boulder.name,
        // Non nul : le where ne garde que les inclinaisons cotées.
        gradeRank: grade?.rank as number,
        angleDegrees: filters.angle,
        creatorUsername: boulder.creator.username,
        setterName: boulder.setterName,
        tags: boulder.boulderTags.map((bt) => bt.tag.slug),
        ascentCount: _count.ascents,
        averageRating: ratingByBoulder.get(boulder.id) ?? null,
        kilterAscensionists: kilterStats?.ascensionistCount ?? null,
        kilterQuality: kilterStats?.qualityAverage ?? null,
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
        boulderAngles: {
          select: {
            votesCount: true,
            angle: { select: { valueDegrees: true } },
            grade: { select: { vScale: true, rank: true } },
            baseGrade: { select: { rank: true } },
            kilterStats: {
              select: { ascensionistCount: true, qualityAverage: true },
            },
          },
          orderBy: { angle: { valueDegrees: 'asc' } },
        },
      },
    });

    assertFound(boulder, 'Boulder');

    const publicNotes = await this.findComments(id);

    const ratings = await this.prisma.ascent.aggregate({
      where: { boulderId: id, rating: { not: null } },
      _avg: { rating: true },
    });

    // Le premier niveau décrit l'inclinaison de référence (`gradeRank`,
    // `angleDegrees`) : ses statistiques Kilter aussi. Les autres sont dans
    // `angleGrades`.
    const referenceStats = boulder.boulderAngles.find(
      (ba) => ba.angle.valueDegrees === boulder.angle.valueDegrees,
    )?.kilterStats;

    return {
      id: boulder.id,
      name: boulder.name,
      gradeRank: boulder.grade.rank,
      angleDegrees: boulder.angle.valueDegrees,
      creatorUsername: boulder.creator.username,
      setterName: boulder.setterName,
      tags: boulder.boulderTags.map((bt) => bt.tag.slug),
      ascentCount: boulder._count.ascents,
      averageRating: ratings._avg.rating,
      kilterAscensionists: referenceStats?.ascensionistCount ?? null,
      kilterQuality: referenceStats?.qualityAverage ?? null,
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
      angleGrades: boulder.boulderAngles.map((ba) => ({
        angleDegrees: ba.angle.valueDegrees,
        gradeRank: ba.grade?.rank ?? null,
        baseGradeRank: ba.baseGrade?.rank ?? null,
        votesCount: ba.votesCount,
        isEstimated: isEstimatedGrade(ba.votesCount, ba.baseGrade !== null),
        kilterAscensionists: ba.kilterStats?.ascensionistCount ?? null,
        kilterQuality: ba.kilterStats?.qualityAverage ?? null,
      })),
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
            feltGrade: { select: { rank: true } },
            angle: { select: { valueDegrees: true } },
          },
        },
        _count: { select: { ascentNoteLikes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => ({
      id: note.id,
      angleDegrees: note.ascent.angle.valueDegrees,
      username: note.user.username,
      avatarUrl: note.user.avatarUrl,
      content: note.content,
      feltGradeRank: note.ascent.feltGrade?.rank ?? null,
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

  /**
   * Pose le like à une inclinaison. Le même bloc liké à deux inclinaisons fait
   * deux favoris. Idempotent : liker un bloc déjà liké à cette inclinaison
   * réussit sans rien changer, pour qu'un renvoi après une réponse perdue ne
   * finisse pas en erreur.
   */
  async like(
    userId: number,
    boulderId: number,
    angleDegrees: number,
  ): Promise<BoulderLikeStatusDto> {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id: boulderId, isPublic: true, isDraft: false },
      select: { id: true },
    });
    assertFound(boulder, 'Boulder');
    const angleId = await resolveAngleId(this.prisma, angleDegrees);

    // `skipDuplicates` devient `ON CONFLICT DO NOTHING` : la base absorbe le
    // doublon, y compris entre deux requêtes simultanées. Un `create` lèverait
    // P2002, et un findUnique préalable laisserait passer la course.
    // Le `createdAt` du premier like est conservé.
    await this.prisma.boulderLike.createMany({
      data: [{ userId, boulderId, angleId }],
      skipDuplicates: true,
    });

    return { liked: true };
  }

  /**
   * Retire le like à une inclinaison. Idempotent : retirer un like absent
   * réussit aussi. `deleteMany` ne lève pas quand rien ne correspond,
   * contrairement à `delete` (P2025). Ni contrôle d'existence du bloc, ni
   * résolution de l'inclinaison (filtre sur la relation) : l'état demandé,
   * « pas liké », est vrai dans tous les cas, même à une inclinaison inconnue.
   */
  async unlike(
    userId: number,
    boulderId: number,
    angleDegrees: number,
  ): Promise<void> {
    await this.prisma.boulderLike.deleteMany({
      where: { userId, boulderId, angle: { valueDegrees: angleDegrees } },
    });
  }

  /**
   * Même raisonnement que `unlike` : une inclinaison inconnue n'a pas de like,
   * la réponse est `false` et non une erreur.
   */
  async isLiked(
    userId: number,
    boulderId: number,
    angleDegrees: number,
  ): Promise<BoulderLikeStatusDto> {
    const like = await this.prisma.boulderLike.findFirst({
      where: { userId, boulderId, angle: { valueDegrees: angleDegrees } },
      select: { userId: true },
    });

    return { liked: like !== null };
  }

  /**
   * Blocs likés par l'utilisateur, du plus récent like au plus ancien. Une
   * entrée par (bloc, inclinaison) : `angleDegrees` est celle du like, pas
   * celle du créateur, pour que la carte rouvre le bloc là où il a été liké.
   * La cotation est celle de cette inclinaison, `null` si elle n'est pas cotée.
   */
  async findMyLikes(userId: number): Promise<LikedBoulderDto[]> {
    const likes = await this.prisma.boulderLike.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        angle: { select: { valueDegrees: true } },
        boulder: { select: { id: true, name: true } },
        // Cotation effective du bloc à l'inclinaison du like.
        boulderAngle: {
          select: { grade: { select: { rank: true } } },
        },
      },
    });

    return likes.map((like) => ({
      id: like.boulder.id,
      name: like.boulder.name,
      gradeRank: like.boulderAngle.grade?.rank ?? null,
      angleDegrees: like.angle.valueDegrees,
      likedAt: like.createdAt,
    }));
  }
}
