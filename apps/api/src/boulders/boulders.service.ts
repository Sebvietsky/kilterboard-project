import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertFound } from '../common/utils/ownership.utils';
import { PrismaService } from '../prisma/prisma.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import {
  BoulderHoldInputDto,
  CreateBoulderDto,
  MAX_END_HOLDS,
} from './dto/create-boulder.dto';
import { UpdateBoulderDto } from './dto/update-boulder.dto';
import {
  BoulderCreatedDto,
  BoulderDetailDto,
  BoulderDraftDto,
  BoulderDraftSummaryDto,
  BoulderLikeStatusDto,
  BoulderSummaryDto,
  LikedBoulderDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';
import { BoulderStatus, HoldRole, Prisma } from '../generated/prisma/client';
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
        status: BoulderStatus.PUBLIC,
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
        status: boulder.status,
        createdAt: boulder.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number): Promise<BoulderDetailDto> {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id, status: BoulderStatus.PUBLIC },
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
      status: boulder.status,
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

  /**
   * Crée un brouillon. Le statut DRAFT est la valeur par défaut de la
   * colonne : un bloc ne naît jamais publié.
   */
  async createDraft(
    userId: number,
    dto: CreateBoulderDto,
  ): Promise<BoulderCreatedDto> {
    assertEndHolds(dto.holds);
    const angleId = await resolveAngleId(this.prisma, dto.angleDegrees);

    const gradeId = await this.resolveGradeId(dto.gradeRank);
    // Le layout se déduit des prises.
    const layoutId = await this.resolveHoldsLayout(dto.holds);
    const tagIds = await this.resolveTagIds(dto.tags ?? []);

    const angles = await this.prisma.angle.findMany({ select: { id: true } });

    return this.prisma.$transaction(async (tx) => {
      const boulder = await tx.boulder.create({
        data: {
          name: dto.name,
          description: dto.description,
          creatorId: userId,
          layoutId,
          angleId,
          gradeId,
          boulderHolds: {
            create: dto.holds.map((h) => ({ holdId: h.holdId, role: h.role })),
          },
          boulderTags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        select: { id: true, status: true },
      });
      // Une ligne par inclinaison de la table, comme pour tout bloc. Seule
      // celle du créateur a une cotation de départ ; sans vote, la cotation
      // effective est la cotation de départ (community-grade.ts).
      await tx.boulderAngle.createMany({
        data: angles.map((a) => {
          const base = a.id === angleId ? gradeId : null;
          return {
            boulderId: boulder.id,
            angleId: a.id,
            baseGradeId: base,
            gradeId: base,
          };
        }),
      });
      return boulder;
    });
  }

  /** Mes brouillons, du dernier modifié au plus ancien. */
  async findMyDrafts(userId: number): Promise<BoulderDraftSummaryDto[]> {
    const drafts = await this.prisma.boulder.findMany({
      where: { creatorId: userId, status: BoulderStatus.DRAFT },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        updatedAt: true,
        angle: { select: { valueDegrees: true } },
        grade: { select: { rank: true } },
      },
    });
    return drafts.map((d) => ({
      id: d.id,
      name: d.name,
      angleDegrees: d.angle.valueDegrees,
      gradeRank: d.grade.rank,
      updatedAt: d.updatedAt,
    }));
  }

  /**
   * Un brouillon, pour l'éditer. 404 sur le brouillon d'un autre (B4) comme
   * sur un bloc publié, qui n'est plus un brouillon : sa page est
   * `GET /boulders/:id`. La règle est portée par le where.
   */
  async findMyDraft(userId: number, id: number): Promise<BoulderDraftDto> {
    const draft = await this.prisma.boulder.findFirst({
      where: { id, creatorId: userId, status: BoulderStatus.DRAFT },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        angle: { select: { valueDegrees: true } },
        grade: { select: { rank: true } },
        boulderHolds: {
          select: { holdId: true, role: true },
          orderBy: { holdId: 'asc' },
        },
        boulderTags: { select: { tag: { select: { slug: true } } } },
      },
    });
    if (!draft) throw new NotFoundException('Boulder not found');
    return {
      id: draft.id,
      name: draft.name,
      description: draft.description,
      angleDegrees: draft.angle.valueDegrees,
      gradeRank: draft.grade.rank,
      updatedAt: draft.updatedAt,
      holds: draft.boulderHolds,
      tags: draft.boulderTags.map((bt) => bt.tag.slug),
    };
  }

  /**
   * Modifie un brouillon : nom, description, cotation provisoire, prises.
   * L'inclinaison est fixée à la création (décision du 2026-11-18).
   */
  async updateDraft(
    userId: number,
    id: number,
    dto: UpdateBoulderDto,
  ): Promise<BoulderCreatedDto> {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id },
      select: { creatorId: true, status: true, layoutId: true, angleId: true },
    });
    // Un brouillon n'existe que pour son créateur (B4) : 404 et non 403,
    // qui révélerait qu'il existe.
    if (!boulder || boulder.creatorId !== userId) {
      throw new NotFoundException('Boulder not found');
    }
    // Un bloc publié peut avoir des ascensions : ses prises et sa cotation
    // ne bougent plus.
    if (boulder.status !== BoulderStatus.DRAFT) {
      throw new ConflictException('Only a draft can be edited.');
    }

    const gradeId =
      dto.gradeRank === undefined
        ? undefined
        : await this.resolveGradeId(dto.gradeRank);
    // Le layout est fixé à la création, par les premières prises.
    if (dto.holds) {
      assertEndHolds(dto.holds);
      await this.resolveHoldsLayout(dto.holds, boulder.layoutId);
    }
    const tagIds =
      dto.tags === undefined ? undefined : await this.resolveTagIds(dto.tags);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.boulder.update({
        where: { id },
        data: { name: dto.name, description: dto.description, gradeId },
        select: { id: true, status: true },
      });
      // La cotation de départ vit sur la ligne de l'inclinaison du créateur.
      // Un brouillon n'a pas de vote (on ne logge pas un brouillon) : la
      // cotation effective est la cotation de départ, sans recalcul.
      if (gradeId !== undefined) {
        await tx.boulderAngle.update({
          where: {
            boulderId_angleId: { boulderId: id, angleId: boulder.angleId },
          },
          data: { baseGradeId: gradeId, gradeId },
        });
      }
      // Le client envoie toutes les prises : elles remplacent les anciennes.
      if (dto.holds) {
        await tx.boulderHold.deleteMany({ where: { boulderId: id } });
        await tx.boulderHold.createMany({
          data: dto.holds.map((h) => ({
            boulderId: id,
            holdId: h.holdId,
            role: h.role,
          })),
        });
      }
      // Comme les prises : les tags envoyés remplacent les anciens.
      if (tagIds) {
        await tx.boulderTag.deleteMany({ where: { boulderId: id } });
        await tx.boulderTag.createMany({
          data: tagIds.map((tagId) => ({ boulderId: id, tagId })),
        });
      }
      return updated;
    });
  }

  /**
   * Supprime un brouillon. Un bloc publié ne se supprime pas : il peut avoir
   * des ascensions, et la publication est un aller simple (décision du
   * 2026-11-18). Prises, inclinaisons, tags et entrées de playlist partent
   * avec lui (cascade).
   */
  async deleteDraft(userId: number, id: number): Promise<void> {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id },
      select: { creatorId: true, status: true },
    });
    // Un brouillon n'existe que pour son créateur (B4) : 404 et non 403.
    if (!boulder || boulder.creatorId !== userId) {
      throw new NotFoundException('Boulder not found');
    }
    if (boulder.status !== BoulderStatus.DRAFT) {
      throw new ConflictException('Only a draft can be deleted.');
    }
    // Le statut dans le where, comme la publication : un brouillon publié
    // entre la lecture et l'écriture n'est pas supprimé.
    const { count } = await this.prisma.boulder.deleteMany({
      where: { id, status: BoulderStatus.DRAFT },
    });
    if (count === 0) {
      throw new ConflictException('Only a draft can be deleted.');
    }
  }

  /** Résolution rank -> Grade.id (rank est @unique ; rank inconnu -> 400). */
  private async resolveGradeId(rank: number): Promise<number> {
    const grade = await this.prisma.grade.findUnique({
      where: { rank },
      select: { id: true },
    });
    if (!grade) throw new BadRequestException('Invalid grade.');
    return grade.id;
  }

  /** Résolution slug -> Tag.id ; un slug inconnu -> 400. */
  private async resolveTagIds(slugs: readonly string[]): Promise<number[]> {
    if (slugs.length === 0) return [];
    // Le DTO garantit des slugs distincts : un slug absent se voit au compte.
    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: [...slugs] } },
      select: { id: true },
    });
    if (tags.length !== slugs.length) {
      throw new BadRequestException('Invalid tag.');
    }
    return tags.map((t) => t.id);
  }

  /**
   * Vérifie que les prises existent et viennent toutes d'un même layout, et
   * le renvoie. `expectedLayoutId` : celui du bloc, quand il existe déjà.
   */
  private async resolveHoldsLayout(
    holds: readonly BoulderHoldInputDto[],
    expectedLayoutId?: number,
  ): Promise<number> {
    // Le DTO garantit des ids distincts : une prise absente se voit au compte.
    const holdIds = holds.map((h) => h.holdId);
    const found = await this.prisma.hold.findMany({
      where: { id: { in: holdIds } },
      select: { layoutId: true },
    });
    if (found.length !== holdIds.length) {
      throw new BadRequestException('Invalid hold.');
    }
    const layoutIds = new Set(found.map((h) => h.layoutId));
    const [layoutId] = layoutIds;
    if (
      layoutIds.size !== 1 ||
      (expectedLayoutId !== undefined && layoutId !== expectedLayoutId)
    ) {
      throw new BadRequestException('Holds must belong to the same layout.');
    }
    return layoutId;
  }

  /**
   * Publie un brouillon : DRAFT -> PUBLIC, sans retour (décision du
   * 2026-11-18). Un bloc publié peut recevoir des ascensions, il ne se
   * modifie plus.
   */
  async publishBoulder(id: number, userId: number): Promise<BoulderCreatedDto> {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id },
      select: {
        creatorId: true,
        status: true,
        boulderHolds: { select: { role: true } },
      },
    });
    // Un brouillon n'existe que pour son créateur (B4) : 404 et non 403.
    if (!boulder || boulder.creatorId !== userId) {
      throw new NotFoundException('Boulder not found');
    }
    if (boulder.status !== BoulderStatus.DRAFT) {
      throw new ConflictException('Boulder is already published.');
    }
    // Un bloc se grimpe d'un départ à un top : exigé ici et non à la
    // création, où le brouillon peut ne pas être fini.
    const roles = new Set(boulder.boulderHolds.map((h) => h.role));
    if (!roles.has(HoldRole.START) || !roles.has(HoldRole.FINISH)) {
      throw new BadRequestException(
        'A boulder needs at least one START and one FINISH hold.',
      );
    }

    // Le statut dans le where : un PATCH ou une publication arrivés entre la
    // lecture et l'écriture ne s'appliquent pas à un bloc déjà publié.
    const { count } = await this.prisma.boulder.updateMany({
      where: { id, status: BoulderStatus.DRAFT },
      data: { status: BoulderStatus.PUBLIC },
    });
    if (count === 0) {
      throw new ConflictException('Boulder is already published.');
    }
    return { id, status: BoulderStatus.PUBLIC };
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
      where: { id: boulderId, status: BoulderStatus.PUBLIC },
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

/**
 * Au plus 2 prises de départ et 2 de fin (Seb, 2026-11-23). Vérifié à chaque
 * écriture des prises, brouillon compris ; le minimum (un START et un
 * FINISH) ne s'exige qu'à la publication.
 */
function assertEndHolds(holds: readonly BoulderHoldInputDto[]): void {
  for (const role of [HoldRole.START, HoldRole.FINISH]) {
    if (holds.filter((h) => h.role === role).length > MAX_END_HOLDS) {
      throw new BadRequestException(
        `A boulder has at most ${MAX_END_HOLDS} START and ${MAX_END_HOLDS} FINISH holds.`,
      );
    }
  }
}
