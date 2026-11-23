import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BouldersService } from './boulders.service';
import { PrismaService } from '../prisma/prisma.service';
import { BoulderStatus, HoldRole } from '../generated/prisma/client';

const prismaMock = {
  boulder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  ascent: { groupBy: jest.fn(), aggregate: jest.fn() },
  ascentNote: { findMany: jest.fn() },
  boulderLike: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  angle: { findUnique: jest.fn(), findMany: jest.fn() },
  boulderAngle: { findMany: jest.fn(), count: jest.fn() },
  grade: { findUnique: jest.fn() },
  hold: { findMany: jest.fn() },
  tag: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

// Le client que reçoit le callback de la transaction. Ses écritures n'existent
// pas sur prismaMock : un appel par `this.prisma` au lieu de `tx` échouerait.
const txMock = {
  boulder: { create: jest.fn(), update: jest.fn() },
  boulderAngle: { createMany: jest.fn(), update: jest.fn() },
  boulderHold: { deleteMany: jest.fn(), createMany: jest.fn() },
  boulderTag: { deleteMany: jest.fn(), createMany: jest.fn() },
};

// La forme minimale que findOne déréférence (et que le catalogue reprend
// sous `boulder`).
const boulderRow = {
  id: 10,
  name: 'Crimpy',
  grade: { vScale: 'V4', fontScale: '6B+', rank: 6 },
  creator: { username: 'seb' },
  setterName: null,
  angle: { valueDegrees: 40 },
  boulderTags: [{ tag: { name: 'Crimp', slug: 'crimp' } }],
  _count: { ascents: 3 },
  status: BoulderStatus.PUBLIC,
  createdAt: new Date(),
};

// Une ligne du catalogue : le bloc à une inclinaison (`boulder_angles`), avec
// la cotation et le nombre d'ascensions de cette inclinaison.
const catalogRow = {
  boulderId: 10,
  grade: { rank: 7 },
  _count: { ascents: 2 },
  kilterStats: null,
  boulder: boulderRow,
};

// L'inclinaison demandée (40°) a l'id 5 dans `angles`.
const ANGLE_ID = 5;

type FindManyArg = {
  where: Record<string, unknown> & { boulder: Record<string, unknown> };
  orderBy: unknown;
};

function findManyArg(): FindManyArg {
  const [arg] = prismaMock.boulderAngle.findMany.mock.calls[0] as [FindManyArg];
  return arg;
}

describe('BouldersService', () => {
  let service: BouldersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BouldersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(BouldersService);
    prismaMock.boulderAngle.findMany.mockResolvedValue([catalogRow]);
    prismaMock.boulderAngle.count.mockResolvedValue(1);
    prismaMock.ascent.groupBy.mockResolvedValue([]);
  });

  describe('findAll — filtres', () => {
    beforeEach(() => {
      prismaMock.angle.findUnique.mockResolvedValue({ id: ANGLE_ID });
    });

    // Le catalogue ne montre que le publié. Ces deux conditions ne dépendent
    // d'aucun filtre : une régression les rendrait invisibles, mais exposerait
    // les brouillons de tout le monde.
    it('exclut toujours les brouillons', async () => {
      await service.findAll({ angle: 40 });

      expect(findManyArg().where.boulder).toMatchObject({
        status: BoulderStatus.PUBLIC,
      });
    });

    // Explore est toujours à une inclinaison, et un bloc n'y apparaît que
    // s'il y est coté (cotation de départ ou votes).
    it("ne garde que les blocs cotés à l'inclinaison demandée", async () => {
      await service.findAll({ angle: 40 });

      expect(prismaMock.angle.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { valueDegrees: 40 } }),
      );
      expect(findManyArg().where).toEqual({
        angleId: ANGLE_ID,
        gradeId: { not: null },
        boulder: { status: BoulderStatus.PUBLIC },
      });
    });

    it('rejette une inclinaison absente de la table', async () => {
      prismaMock.angle.findUnique.mockResolvedValue(null);

      await expect(service.findAll({ angle: 40 })).rejects.toThrow(
        BadRequestException,
      );
    });

    // La cotation filtrée est celle de l'inclinaison (`boulder_angles.grade`),
    // pas la référence du créateur : un bloc 6c à 40° peut être 7a à 50°.
    // Les deux bornes sont indépendantes : un minimum seul donne un gte seul.
    it("filtre sur la cotation à l'inclinaison, une borne seule comprise", async () => {
      await service.findAll({ angle: 40, gradeMin: 5 });

      expect(findManyArg().where).toMatchObject({
        grade: { rank: { gte: 5 } },
      });
    });

    it('accepte les deux bornes de cotation', async () => {
      await service.findAll({ angle: 40, gradeMin: 5, gradeMax: 9 });

      expect(findManyArg().where).toMatchObject({
        grade: { rank: { gte: 5, lte: 9 } },
      });
    });

    // Le créateur d'un bloc importé est son setter Kilter : le filtre cherche
    // dans les deux, sinon « JustinKo » ne trouverait aucun de ses blocs.
    it('cherche le nom et le créateur (compte ou setter Kilter) sans tenir compte de la casse', async () => {
      await service.findAll({ angle: 40, name: 'CRIMP', creator: 'Seb' });

      expect(findManyArg().where.boulder).toMatchObject({
        name: { contains: 'CRIMP', mode: 'insensitive' },
        OR: [
          { creator: { username: { contains: 'Seb', mode: 'insensitive' } } },
          { setterName: { contains: 'Seb', mode: 'insensitive' } },
        ],
      });
    });

    // Plusieurs tags se cumulent en ET, pas en OU : demander « crimp + dyno »
    // doit rendre les blocs qui portent les deux. Un `some` avec un `in`
    // renverrait ceux qui portent l'un ou l'autre — la nuance ne se voit pas
    // en lisant le résultat, seulement en lisant la requête.
    it('cumule les tags en ET', async () => {
      await service.findAll({ angle: 40, tags: ['crimp', 'dyno'] });

      expect(findManyArg().where.boulder).toMatchObject({
        AND: [
          { boulderTags: { some: { tag: { slug: 'crimp' } } } },
          { boulderTags: { some: { tag: { slug: 'dyno' } } } },
        ],
      });
    });

    // Popularité Kilter à cette inclinaison d'abord (0 pour un bloc créé dans
    // l'app, qui passe donc après), puis nos ascensions, puis un ordre stable
    // pour que la pagination ne saute ni ne répète aucun bloc.
    it('trie par popularité Kilter, puis par nos ascensions', async () => {
      await service.findAll({ angle: 40 });

      expect(findManyArg().orderBy).toEqual([
        { kilterAscensionists: 'desc' },
        { ascents: { _count: 'desc' } },
        { boulderId: 'asc' },
      ]);
    });
  });

  describe('findAll — sortie', () => {
    beforeEach(() => {
      prismaMock.angle.findUnique.mockResolvedValue({ id: ANGLE_ID });
    });

    // Une carte = le bloc à l'inclinaison demandée : cotation et ascensions
    // de cette inclinaison, pas la référence du créateur (V4 à 40° ici, rang 6).
    it("projette le bloc à l'inclinaison demandée", async () => {
      const { data } = await service.findAll({ angle: 45 });

      expect(data[0]).toMatchObject({
        id: 10,
        name: 'Crimpy',
        gradeRank: 7,
        angleDegrees: 45,
        creatorUsername: 'seb',
        setterName: null,
        tags: ['crimp'],
        ascentCount: 2,
      });
    });

    // Un bloc importé appartient en base au compte système `kilter` : le
    // client affiche le setter Kilter, que le résumé doit donc porter.
    it('donne le setter Kilter d’un bloc importé', async () => {
      prismaMock.boulderAngle.findMany.mockResolvedValue([
        {
          ...catalogRow,
          boulder: {
            ...boulderRow,
            creator: { username: 'kilter' },
            setterName: 'JustinKo',
          },
        },
      ]);

      const { data } = await service.findAll({ angle: 40 });

      expect(data[0]).toMatchObject({
        creatorUsername: 'kilter',
        setterName: 'JustinKo',
      });
    });

    // Les chiffres Kilter restent à part des nôtres (décision du 2026-11-06) :
    // grimpeurs sur toute la communauté contre nos lignes d'ascension.
    it("donne les statistiques Kilter de l'inclinaison, à part des nôtres", async () => {
      prismaMock.boulderAngle.findMany.mockResolvedValue([
        {
          ...catalogRow,
          kilterStats: { ascensionistCount: 104258, qualityAverage: 3.1 },
        },
      ]);

      const { data } = await service.findAll({ angle: 40 });

      expect(data[0]).toMatchObject({
        ascentCount: 2,
        kilterAscensionists: 104258,
        kilterQuality: 3.1,
      });
    });

    it('renvoie null sans statistiques Kilter (bloc créé dans l’app)', async () => {
      const { data } = await service.findAll({ angle: 40 });

      expect(data[0]).toMatchObject({
        kilterAscensionists: null,
        kilterQuality: null,
      });
    });

    // La note moyenne est celle de l'inclinaison affichée, comme la cotation.
    it("ne moyenne que les notes données à l'inclinaison demandée", async () => {
      await service.findAll({ angle: 40 });

      const [arg] = prismaMock.ascent.groupBy.mock.calls[0] as [
        { where: unknown },
      ];
      expect(arg.where).toEqual({
        boulderId: { in: [10] },
        angleId: ANGLE_ID,
        rating: { not: null },
      });
    });

    // Aucune note ne doit donner null, pas 0 : une moyenne de 0 se lirait
    // comme « très mal noté » alors que personne n'a voté.
    it('renvoie null comme note moyenne quand personne na voté', async () => {
      const { data } = await service.findAll({ angle: 40 });

      expect(data[0].averageRating).toBeNull();
    });

    it('associe chaque moyenne à son bloc', async () => {
      prismaMock.ascent.groupBy.mockResolvedValue([
        { boulderId: 10, _avg: { rating: 4.5 } },
      ]);

      const { data } = await service.findAll({ angle: 40 });

      expect(data[0].averageRating).toBe(4.5);
    });

    it('calcule le nombre total de pages', async () => {
      prismaMock.boulderAngle.count.mockResolvedValue(45);

      const { meta } = await service.findAll({ angle: 40, limit: 20 });

      expect(meta).toEqual({ total: 45, page: 1, limit: 20, totalPages: 3 });
    });
  });

  describe('findOne', () => {
    // Bloc créé à 40°, coté V4 par son créateur ; cotation de départ aussi à
    // 45° (celle de Kilter pour un bloc importé), aucune à 50° ni à 60°.
    const detailRow = {
      ...boulderRow,
      angleId: 5,
      description: 'Sloper exit',
      boulderHolds: [{ role: 'START', hold: { holdCode: 'A1', x: 10, y: 20 } }],
      boulderAngles: [
        {
          votesCount: 2,
          angle: { valueDegrees: 40 },
          grade: { vScale: 'V4', rank: 6 },
          baseGrade: { rank: 6 },
          kilterStats: { ascensionistCount: 1200, qualityAverage: 3.1 },
        },
        {
          votesCount: 1,
          angle: { valueDegrees: 45 },
          grade: { vScale: 'V5', rank: 7 },
          baseGrade: { rank: 7 },
          kilterStats: { ascensionistCount: 300, qualityAverage: null },
        },
        {
          votesCount: 1,
          angle: { valueDegrees: 50 },
          grade: { vScale: 'V6', rank: 8 },
          baseGrade: null,
          kilterStats: null,
        },
        {
          votesCount: 0,
          angle: { valueDegrees: 60 },
          grade: null,
          baseGrade: null,
          kilterStats: null,
        },
      ],
    };

    beforeEach(() => {
      prismaMock.ascentNote.findMany.mockResolvedValue([]);
      prismaMock.ascent.aggregate.mockResolvedValue({ _avg: { rating: null } });
    });

    // La visibilité est portée par le where, pas par un test après coup : un
    // brouillon n'est pas trouvé du tout, donc 404 et non 403 — révéler qu'il
    // existe serait déjà une fuite.
    it('ne cherche que parmi les blocs publics et publiés', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(detailRow);

      await service.findOne(10);

      expect(prismaMock.boulder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10, status: BoulderStatus.PUBLIC },
        }),
      );
    });

    it('rejette un bloc introuvable', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.findOne(10)).rejects.toThrow(NotFoundException);
    });

    it('aplatit les prises avec leur rôle', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(detailRow);

      const detail = await service.findOne(10);

      expect(detail.holds).toEqual([
        { holdCode: 'A1', x: 10, y: 20, role: 'START' },
      ]);
    });

    // Le premier niveau du détail décrit l'inclinaison de référence : ses
    // statistiques Kilter aussi. Référence à 45° ici, après 40° qui a les
    // siennes : prendre la première inclinaison venue donnerait celles de 40°.
    it("donne au premier niveau les statistiques Kilter de l'inclinaison de référence", async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({
        ...detailRow,
        angle: { valueDegrees: 45 },
      });

      const detail = await service.findOne(10);

      expect(detail).toMatchObject({
        angleDegrees: 45,
        kilterAscensionists: 300,
        kilterQuality: null,
      });
    });

    // « Estimée » se déduit : peu de votes, et seulement sans cotation de
    // départ. Une inclinaison qui en a une la garde sous le seuil : ce n'est
    // pas une estimation, même avec un vote, qu'elle vienne du créateur ou de
    // Kilter.
    it('donne la cotation de chaque inclinaison, estimée seulement sans cotation de départ', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(detailRow);

      const detail = await service.findOne(10);

      expect(detail.angleGrades).toEqual([
        {
          angleDegrees: 40,
          gradeRank: 6,
          baseGradeRank: 6,
          votesCount: 2,
          isEstimated: false,
          kilterAscensionists: 1200,
          kilterQuality: 3.1,
        },
        {
          angleDegrees: 45,
          gradeRank: 7,
          baseGradeRank: 7,
          votesCount: 1,
          isEstimated: false,
          kilterAscensionists: 300,
          kilterQuality: null,
        },
        {
          angleDegrees: 50,
          gradeRank: 8,
          baseGradeRank: null,
          votesCount: 1,
          isEstimated: true,
          kilterAscensionists: null,
          kilterQuality: null,
        },
        {
          angleDegrees: 60,
          gradeRank: null,
          baseGradeRank: null,
          votesCount: 0,
          isEstimated: false,
          kilterAscensionists: null,
          kilterQuality: null,
        },
      ]);
    });
  });

  describe('findComments', () => {
    // Les notes privées et celles des repeats ne sortent jamais : la
    // visibilité est filtrée en base, pas au moment du rendu.
    it('ne remonte que les notes publiques du bloc', async () => {
      prismaMock.ascentNote.findMany.mockResolvedValue([]);

      await service.findComments(10);

      expect(prismaMock.ascentNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { boulderId: 10, visibility: 'PUBLIC' },
        }),
      );
    });

    it('tolère une note dont lauteur na pas donné de cote ressentie', async () => {
      prismaMock.ascentNote.findMany.mockResolvedValue([
        {
          id: 12,
          user: { username: 'seb', avatarUrl: null },
          content: 'Nice',
          ascent: { feltGrade: null, angle: { valueDegrees: 50 } },
          _count: { ascentNoteLikes: 2 },
          createdAt: new Date(),
        },
      ]);

      const [note] = await service.findComments(10);

      expect(note).toMatchObject({ feltGradeRank: null, likesCount: 2 });
    });

    // L'id sert de clé de liste côté client ; l'inclinaison, de filtre. Elle
    // vient de l'ascension commentée, pas du bloc (créé à une autre).
    it("expose l'id et l'inclinaison de l'ascension commentée", async () => {
      prismaMock.ascentNote.findMany.mockResolvedValue([
        {
          id: 12,
          user: { username: 'seb', avatarUrl: null },
          content: 'Nice',
          ascent: {
            feltGrade: { rank: 20 },
            angle: { valueDegrees: 50 },
          },
          _count: { ascentNoteLikes: 0 },
          createdAt: new Date(),
        },
      ]);

      const [note] = await service.findComments(10);

      expect(note).toMatchObject({ id: 12, angleDegrees: 50 });
    });
  });

  describe('publishBoulder', () => {
    const draft = {
      creatorId: 1,
      status: BoulderStatus.DRAFT,
      boulderHolds: [
        { role: HoldRole.START },
        { role: HoldRole.HAND },
        { role: HoldRole.FINISH },
      ],
    };

    beforeEach(() => {
      prismaMock.boulder.findUnique.mockResolvedValue(draft);
      prismaMock.boulder.updateMany.mockResolvedValue({ count: 1 });
    });

    it('publie le brouillon de son créateur', async () => {
      await expect(service.publishBoulder(10, 1)).resolves.toEqual({
        id: 10,
        status: BoulderStatus.PUBLIC,
      });

      expect(prismaMock.boulder.updateMany).toHaveBeenCalledWith({
        where: { id: 10, status: BoulderStatus.DRAFT },
        data: { status: BoulderStatus.PUBLIC },
      });
    });

    // Un brouillon n'existe que pour son créateur (B4) : 404 et non 403, qui
    // révélerait qu'il existe.
    it("renvoie 404 sur le brouillon d'un autre", async () => {
      await expect(service.publishBoulder(10, 999)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.boulder.updateMany).not.toHaveBeenCalled();
    });

    it('rejette un bloc inexistant', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.publishBoulder(10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    // Publier est un aller simple : un bloc publié ne revient pas en
    // brouillon, et ne se republie pas.
    it('renvoie 409 sur un bloc déjà publié', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({
        ...draft,
        status: BoulderStatus.PUBLIC,
      });

      await expect(service.publishBoulder(10, 1)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.boulder.updateMany).not.toHaveBeenCalled();
    });

    // Publié entre la lecture et l'écriture (autre appareil) : l'écriture
    // conditionnée au statut ne trouve plus de brouillon.
    it('renvoie 409 si le bloc a été publié entre-temps', async () => {
      prismaMock.boulder.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.publishBoulder(10, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    // START et FINISH ne s'exigent qu'à la publication (décision du
    // 2026-11-18).
    it.each([
      ['sans START', [HoldRole.HAND, HoldRole.FINISH]],
      ['sans FINISH', [HoldRole.START, HoldRole.HAND]],
    ])('refuse un bloc %s', async (_label, roles) => {
      prismaMock.boulder.findUnique.mockResolvedValue({
        ...draft,
        boulderHolds: roles.map((role) => ({ role })),
      });

      await expect(service.publishBoulder(10, 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.boulder.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('like', () => {
    beforeEach(() => {
      prismaMock.angle.findUnique.mockResolvedValue({ id: 7 }); // 50°
    });

    // PUT est idempotent : le doublon est absorbé par la base
    // (`skipDuplicates`), jamais remonté en erreur au client.
    it("pose le like à l'inclinaison demandée, doublon absorbé par la base", async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });

      await expect(service.like(1, 10, 50)).resolves.toEqual({ liked: true });
      expect(prismaMock.angle.findUnique).toHaveBeenCalledWith({
        where: { valueDegrees: 50 },
        select: { id: true },
      });
      expect(prismaMock.boulderLike.createMany).toHaveBeenCalledWith({
        data: [{ userId: 1, boulderId: 10, angleId: 7 }],
        skipDuplicates: true,
      });
    });

    it('ne cherche que parmi les blocs publics et publiés', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });

      await service.like(1, 10, 50);

      const [arg] = prismaMock.boulder.findUnique.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(arg.where).toMatchObject({ status: BoulderStatus.PUBLIC });
    });

    it('rejette un bloc introuvable', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.like(1, 10, 50)).rejects.toThrow(NotFoundException);
      expect(prismaMock.boulderLike.createMany).not.toHaveBeenCalled();
    });

    it('rejette une inclinaison inconnue', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });
      prismaMock.angle.findUnique.mockResolvedValue(null);

      await expect(service.like(1, 10, 47)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.boulderLike.createMany).not.toHaveBeenCalled();
    });
  });

  describe('unlike', () => {
    // DELETE est idempotent : `deleteMany` ne lève pas quand le like
    // n'existe pas, contrairement à `delete`.
    it("retire le like à cette inclinaison sans exiger qu'il existe", async () => {
      prismaMock.boulderLike.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unlike(1, 10, 50)).resolves.toBeUndefined();
      expect(prismaMock.boulderLike.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1, boulderId: 10, angle: { valueDegrees: 50 } },
      });
    });
  });

  describe('isLiked', () => {
    it('renvoie true quand le like existe à cette inclinaison', async () => {
      prismaMock.boulderLike.findFirst.mockResolvedValue({ userId: 1 });

      await expect(service.isLiked(1, 10, 50)).resolves.toEqual({
        liked: true,
      });
      const [arg] = prismaMock.boulderLike.findFirst.mock.calls[0] as [
        { where: unknown },
      ];
      expect(arg.where).toEqual({
        userId: 1,
        boulderId: 10,
        angle: { valueDegrees: 50 },
      });
    });

    it('renvoie false sinon', async () => {
      prismaMock.boulderLike.findFirst.mockResolvedValue(null);

      await expect(service.isLiked(1, 10, 50)).resolves.toEqual({
        liked: false,
      });
    });
  });

  describe('findMyLikes', () => {
    it('trie par like le plus récent et aplatit le bloc', async () => {
      const likedAt = new Date();
      prismaMock.boulderLike.findMany.mockResolvedValue([
        {
          createdAt: likedAt,
          angle: { valueDegrees: 40 },
          boulder: { id: 10, name: 'Crimpy' },
          boulderAngle: { grade: { rank: 6 } },
        },
      ]);

      const result = await service.findMyLikes(1);

      const [arg] = prismaMock.boulderLike.findMany.mock.calls[0] as [
        { where: unknown; orderBy: unknown },
      ];
      expect(arg.where).toEqual({ userId: 1 });
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
      expect(result).toEqual([
        {
          id: 10,
          name: 'Crimpy',
          gradeRank: 6,
          angleDegrees: 40,
          likedAt,
        },
      ]);
    });

    // La cotation vient de la ligne du bloc à l'inclinaison du like : non
    // cotée là, la carte n'affiche pas celle du créateur.
    it("renvoie la cotation de l'inclinaison du like, null si elle n'est pas cotée", async () => {
      prismaMock.boulderLike.findMany.mockResolvedValue([
        {
          createdAt: new Date(),
          angle: { valueDegrees: 50 },
          boulder: { id: 10, name: 'Crimpy' },
          boulderAngle: { grade: null },
        },
      ]);

      const [like] = await service.findMyLikes(1);

      expect(like).toMatchObject({
        angleDegrees: 50,
        gradeRank: null,
      });
    });
  });
  describe('createDraft', () => {
    const CREATOR_ANGLE_ID = 3;
    const GRADE_ID = 16;
    const dto = {
      name: 'Crimpy',
      angleDegrees: 40,
      gradeRank: 6,
      holds: [
        { holdId: 1, role: HoldRole.START },
        { holdId: 2, role: HoldRole.FINISH },
      ],
    };

    beforeEach(() => {
      prismaMock.angle.findUnique.mockResolvedValue({ id: CREATOR_ANGLE_ID });
      prismaMock.grade.findUnique.mockResolvedValue({ id: GRADE_ID });
      prismaMock.hold.findMany.mockResolvedValue([
        { layoutId: 1 },
        { layoutId: 1 },
      ]);
      prismaMock.angle.findMany.mockResolvedValue([
        { id: 2 },
        { id: CREATOR_ANGLE_ID },
        { id: 4 },
      ]);
      prismaMock.$transaction.mockImplementation(
        (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
      );
      txMock.boulder.create.mockResolvedValue({
        id: 99,
        status: BoulderStatus.DRAFT,
      });
    });

    const createArg = () =>
      (
        txMock.boulder.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;

    // Un bloc ne naît jamais publié : le statut n'est pas écrit, la colonne
    // vaut DRAFT par défaut. L'écrire PUBLIC le publierait sans contrôle.
    it('crée un brouillon, sans statut explicite', async () => {
      await expect(service.createDraft(7, dto)).resolves.toEqual({
        id: 99,
        status: BoulderStatus.DRAFT,
      });
      expect(createArg()).not.toHaveProperty('status');
      expect(createArg()).toMatchObject({
        creatorId: 7,
        angleId: CREATOR_ANGLE_ID,
        gradeId: GRADE_ID,
      });
    });

    it('déduit le layout des prises', async () => {
      await service.createDraft(7, dto);

      expect(createArg()).toMatchObject({ layoutId: 1 });
    });

    it('refuse des prises de deux layouts', async () => {
      prismaMock.hold.findMany.mockResolvedValue([
        { layoutId: 1 },
        { layoutId: 2 },
      ]);

      await expect(service.createDraft(7, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(txMock.boulder.create).not.toHaveBeenCalled();
    });

    it('refuse une prise inconnue', async () => {
      prismaMock.hold.findMany.mockResolvedValue([{ layoutId: 1 }]);

      await expect(service.createDraft(7, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(txMock.boulder.create).not.toHaveBeenCalled();
    });

    it('refuse une cotation inconnue', async () => {
      prismaMock.grade.findUnique.mockResolvedValue(null);

      await expect(service.createDraft(7, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(txMock.boulder.create).not.toHaveBeenCalled();
    });

    it('enregistre chaque prise avec son rôle', async () => {
      await service.createDraft(7, dto);

      expect(createArg().boulderHolds).toEqual({
        create: [
          { holdId: 1, role: HoldRole.START },
          { holdId: 2, role: HoldRole.FINISH },
        ],
      });
    });

    // Une ligne par inclinaison, créées avec le bloc (décision du
    // 2026-10-15). Seule celle du créateur a une cotation de départ.
    it('crée toutes les inclinaisons, cotées seulement à celle du créateur', async () => {
      await service.createDraft(7, dto);

      expect(txMock.boulderAngle.createMany).toHaveBeenCalledWith({
        data: [
          { boulderId: 99, angleId: 2, baseGradeId: null, gradeId: null },
          {
            boulderId: 99,
            angleId: CREATOR_ANGLE_ID,
            baseGradeId: GRADE_ID,
            gradeId: GRADE_ID,
          },
          { boulderId: 99, angleId: 4, baseGradeId: null, gradeId: null },
        ],
      });
    });

    // Au plus 2 départs et 2 fins (Seb, 2026-11-23) : la règle porte sur
    // l'ensemble des prises, d'où le service et non le DTO.
    it.each([HoldRole.START, HoldRole.FINISH])(
      'refuse un troisième %s',
      async (role) => {
        // Trois prises connues : sans cela, le refus viendrait de « prise
        // inconnue », et le test passerait sans la règle.
        prismaMock.hold.findMany.mockResolvedValue([
          { layoutId: 1 },
          { layoutId: 1 },
          { layoutId: 1 },
        ]);
        await expect(
          service.createDraft(7, {
            ...dto,
            holds: [
              { holdId: 1, role },
              { holdId: 2, role },
              { holdId: 3, role },
            ],
          }),
        ).rejects.toThrow(BadRequestException);
        expect(txMock.boulder.create).not.toHaveBeenCalled();
      },
    );

    it('accepte 2 départs et 2 fins', async () => {
      prismaMock.hold.findMany.mockResolvedValue([
        { layoutId: 1 },
        { layoutId: 1 },
        { layoutId: 1 },
        { layoutId: 1 },
      ]);

      await expect(
        service.createDraft(7, {
          ...dto,
          holds: [
            { holdId: 1, role: HoldRole.START },
            { holdId: 2, role: HoldRole.START },
            { holdId: 3, role: HoldRole.FINISH },
            { holdId: 4, role: HoldRole.FINISH },
          ],
        }),
      ).resolves.toEqual({ id: 99, status: BoulderStatus.DRAFT });
    });

    it('enregistre les tags par leur id', async () => {
      prismaMock.tag.findMany.mockResolvedValue([{ id: 4 }, { id: 6 }]);

      await service.createDraft(7, { ...dto, tags: ['crimp', 'dyno'] });

      expect(prismaMock.tag.findMany).toHaveBeenCalledWith({
        where: { slug: { in: ['crimp', 'dyno'] } },
        select: { id: true },
      });
      expect(createArg().boulderTags).toEqual({
        create: [{ tagId: 4 }, { tagId: 6 }],
      });
    });

    it('refuse un tag inconnu', async () => {
      prismaMock.tag.findMany.mockResolvedValue([{ id: 4 }]);

      await expect(
        service.createDraft(7, { ...dto, tags: ['crimp', 'nope'] }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.boulder.create).not.toHaveBeenCalled();
    });
  });
  describe('findMyDrafts', () => {
    const findManyArg = () =>
      (
        prismaMock.boulder.findMany.mock.calls[0] as [
          { where: unknown; orderBy: unknown },
        ]
      )[0];

    // Les miens, et seulement les brouillons : sans le filtre de créateur,
    // la liste exposerait les brouillons de tout le monde.
    it('ne lit que mes brouillons', async () => {
      prismaMock.boulder.findMany.mockResolvedValue([]);

      await service.findMyDrafts(7);

      expect(findManyArg().where).toEqual({
        creatorId: 7,
        status: BoulderStatus.DRAFT,
      });
    });

    it('trie du dernier modifié au plus ancien', async () => {
      prismaMock.boulder.findMany.mockResolvedValue([]);

      await service.findMyDrafts(7);

      expect(findManyArg().orderBy).toEqual([
        { updatedAt: 'desc' },
        { id: 'desc' },
      ]);
    });

    it("renvoie l'inclinaison et la cotation provisoire", async () => {
      const updatedAt = new Date();
      prismaMock.boulder.findMany.mockResolvedValue([
        {
          id: 99,
          name: 'Crimpy',
          updatedAt,
          angle: { valueDegrees: 40 },
          grade: { rank: 16 },
        },
      ]);

      await expect(service.findMyDrafts(7)).resolves.toEqual([
        { id: 99, name: 'Crimpy', angleDegrees: 40, gradeRank: 16, updatedAt },
      ]);
    });
  });

  describe('findMyDraft', () => {
    // Le brouillon d'un autre (B4) et un bloc publié donnent le même 404 :
    // la règle est dans le where, la base ne les trouve pas.
    it('ne cherche que parmi mes brouillons', async () => {
      prismaMock.boulder.findFirst.mockResolvedValue(null);

      await expect(service.findMyDraft(7, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        (prismaMock.boulder.findFirst.mock.calls[0] as [{ where: unknown }])[0]
          .where,
      ).toEqual({ id: 99, creatorId: 7, status: BoulderStatus.DRAFT });
    });

    // La forme de PATCH : l'écran renvoie les prises telles qu'il les a lues.
    it("renvoie les prises par id, comme les attend l'édition", async () => {
      const updatedAt = new Date();
      prismaMock.boulder.findFirst.mockResolvedValue({
        id: 99,
        name: 'Crimpy',
        description: null,
        updatedAt,
        angle: { valueDegrees: 40 },
        grade: { rank: 16 },
        boulderHolds: [
          { holdId: 1, role: HoldRole.START },
          { holdId: 2, role: HoldRole.FINISH },
        ],
        boulderTags: [{ tag: { slug: 'crimp' } }],
      });

      await expect(service.findMyDraft(7, 99)).resolves.toEqual({
        id: 99,
        name: 'Crimpy',
        description: null,
        angleDegrees: 40,
        gradeRank: 16,
        updatedAt,
        holds: [
          { holdId: 1, role: HoldRole.START },
          { holdId: 2, role: HoldRole.FINISH },
        ],
        tags: ['crimp'],
      });
    });
  });

  describe('updateDraft', () => {
    const CREATOR_ID = 7;
    const CREATOR_ANGLE_ID = 3;
    const draft = {
      id: 99,
      creatorId: CREATOR_ID,
      status: BoulderStatus.DRAFT,
      layoutId: 1,
      angleId: CREATOR_ANGLE_ID,
    };

    beforeEach(() => {
      prismaMock.boulder.findUnique.mockResolvedValue(draft);
      prismaMock.grade.findUnique.mockResolvedValue({ id: 18 });
      prismaMock.hold.findMany.mockResolvedValue([{ layoutId: 1 }]);
      prismaMock.$transaction.mockImplementation(
        (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
      );
      txMock.boulder.update.mockResolvedValue({
        id: 99,
        status: BoulderStatus.DRAFT,
      });
    });

    const nothingWritten = () => {
      expect(txMock.boulder.update).not.toHaveBeenCalled();
      expect(txMock.boulderAngle.update).not.toHaveBeenCalled();
      expect(txMock.boulderHold.deleteMany).not.toHaveBeenCalled();
    };

    it('renvoie 404 pour un bloc inconnu', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDraft(CREATOR_ID, 99, { name: 'Crimpy' }),
      ).rejects.toThrow(NotFoundException);
      nothingWritten();
    });

    // Un brouillon n'existe que pour son créateur (B4) : 404 et non 403,
    // pour ne pas révéler qu'il existe.
    it("renvoie 404 sur le brouillon d'un autre", async () => {
      await expect(
        service.updateDraft(8, 99, { name: 'Crimpy' }),
      ).rejects.toThrow(NotFoundException);
      nothingWritten();
    });

    // Un bloc publié peut avoir des ascensions : changer ses prises ou sa
    // cotation les rendrait fausses.
    it('renvoie 409 sur un bloc publié', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({
        ...draft,
        status: BoulderStatus.PUBLIC,
      });

      await expect(
        service.updateDraft(CREATOR_ID, 99, { name: 'Crimpy' }),
      ).rejects.toThrow(ConflictException);
      nothingWritten();
    });

    it('modifie le nom et la description', async () => {
      await expect(
        service.updateDraft(CREATOR_ID, 99, {
          name: 'Crimpy',
          description: 'Petites réglettes',
        }),
      ).resolves.toEqual({ id: 99, status: BoulderStatus.DRAFT });

      expect(txMock.boulder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99 },
          data: expect.objectContaining({
            name: 'Crimpy',
            description: 'Petites réglettes',
          }) as unknown,
        }),
      );
    });

    it('refuse une cotation inconnue', async () => {
      prismaMock.grade.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDraft(CREATOR_ID, 99, { gradeRank: 99 }),
      ).rejects.toThrow(BadRequestException);
      nothingWritten();
    });

    // La cotation de départ vit sur la ligne de l'inclinaison du créateur.
    // Un brouillon n'a pas de vote : la cotation effective est la cotation
    // de départ, sans recalcul.
    it("reporte la cotation sur la ligne de l'inclinaison du créateur", async () => {
      await service.updateDraft(CREATOR_ID, 99, { gradeRank: 18 });

      expect(txMock.boulder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gradeId: 18 }) as unknown,
        }),
      );
      expect(txMock.boulderAngle.update).toHaveBeenCalledWith({
        where: {
          boulderId_angleId: { boulderId: 99, angleId: CREATOR_ANGLE_ID },
        },
        data: { baseGradeId: 18, gradeId: 18 },
      });
    });

    it('ne touche pas aux inclinaisons sans nouvelle cotation', async () => {
      await service.updateDraft(CREATOR_ID, 99, { name: 'Crimpy' });

      expect(txMock.boulderAngle.update).not.toHaveBeenCalled();
    });

    it('refuse une prise inconnue', async () => {
      prismaMock.hold.findMany.mockResolvedValue([]);

      await expect(
        service.updateDraft(CREATOR_ID, 99, {
          holds: [{ holdId: 1, role: HoldRole.START }],
        }),
      ).rejects.toThrow(BadRequestException);
      nothingWritten();
    });

    // Le layout du bloc est fixé à la création, par ses premières prises.
    it("refuse une prise d'un autre layout que celui du bloc", async () => {
      prismaMock.hold.findMany.mockResolvedValue([{ layoutId: 2 }]);

      await expect(
        service.updateDraft(CREATOR_ID, 99, {
          holds: [{ holdId: 1, role: HoldRole.START }],
        }),
      ).rejects.toThrow(BadRequestException);
      nothingWritten();
    });

    it('remplace toutes les prises du bloc', async () => {
      await service.updateDraft(CREATOR_ID, 99, {
        holds: [{ holdId: 5, role: HoldRole.FINISH }],
      });

      expect(txMock.boulderHold.deleteMany).toHaveBeenCalledWith({
        where: { boulderId: 99 },
      });
      expect(txMock.boulderHold.createMany).toHaveBeenCalledWith({
        data: [{ boulderId: 99, holdId: 5, role: HoldRole.FINISH }],
      });
      // Supprimer après avoir recréé effacerait les nouvelles prises.
      expect(
        txMock.boulderHold.deleteMany.mock.invocationCallOrder[0],
      ).toBeLessThan(txMock.boulderHold.createMany.mock.invocationCallOrder[0]);
    });

    it('ne touche pas aux prises sans nouvelle liste', async () => {
      await service.updateDraft(CREATOR_ID, 99, { name: 'Crimpy' });

      expect(txMock.boulderHold.deleteMany).not.toHaveBeenCalled();
    });
  });
  describe('updateDraft — départs, fins et tags', () => {
    const draft = {
      id: 99,
      creatorId: 7,
      status: BoulderStatus.DRAFT,
      layoutId: 1,
      angleId: 3,
    };

    beforeEach(() => {
      prismaMock.boulder.findUnique.mockResolvedValue(draft);
      prismaMock.hold.findMany.mockResolvedValue([
        { layoutId: 1 },
        { layoutId: 1 },
        { layoutId: 1 },
      ]);
      prismaMock.$transaction.mockImplementation(
        (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
      );
      txMock.boulder.update.mockResolvedValue({
        id: 99,
        status: BoulderStatus.DRAFT,
      });
    });

    // L'édition ne doit pas contourner ce que la création refuse.
    it('refuse un troisième FINISH', async () => {
      await expect(
        service.updateDraft(7, 99, {
          holds: [
            { holdId: 1, role: HoldRole.FINISH },
            { holdId: 2, role: HoldRole.FINISH },
            { holdId: 3, role: HoldRole.FINISH },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.boulderHold.deleteMany).not.toHaveBeenCalled();
    });

    it('remplace tous les tags du bloc', async () => {
      prismaMock.tag.findMany.mockResolvedValue([{ id: 6 }]);

      await service.updateDraft(7, 99, { tags: ['dyno'] });

      expect(txMock.boulderTag.deleteMany).toHaveBeenCalledWith({
        where: { boulderId: 99 },
      });
      expect(txMock.boulderTag.createMany).toHaveBeenCalledWith({
        data: [{ boulderId: 99, tagId: 6 }],
      });
    });

    it('retire tous les tags avec une liste vide', async () => {
      await service.updateDraft(7, 99, { tags: [] });

      expect(prismaMock.tag.findMany).not.toHaveBeenCalled();
      expect(txMock.boulderTag.deleteMany).toHaveBeenCalledWith({
        where: { boulderId: 99 },
      });
      expect(txMock.boulderTag.createMany).toHaveBeenCalledWith({ data: [] });
    });

    it('ne touche pas aux tags sans `tags`', async () => {
      await service.updateDraft(7, 99, { name: 'Crimpy' });

      expect(txMock.boulderTag.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteDraft', () => {
    const draft = { creatorId: 7, status: BoulderStatus.DRAFT };

    beforeEach(() => {
      prismaMock.boulder.findUnique.mockResolvedValue(draft);
      prismaMock.boulder.deleteMany.mockResolvedValue({ count: 1 });
    });

    // Le statut dans le where : un brouillon publié entre la lecture et
    // l'écriture n'est pas supprimé.
    it('supprime le brouillon de son créateur, et seulement un brouillon', async () => {
      await expect(service.deleteDraft(7, 99)).resolves.toBeUndefined();

      expect(prismaMock.boulder.deleteMany).toHaveBeenCalledWith({
        where: { id: 99, status: BoulderStatus.DRAFT },
      });
    });

    // B4 : 404 et non 403, pour ne pas révéler qu'il existe.
    it("renvoie 404 sur le brouillon d'un autre", async () => {
      await expect(service.deleteDraft(8, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.boulder.deleteMany).not.toHaveBeenCalled();
    });

    it('renvoie 404 sur un bloc inconnu', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.deleteDraft(7, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    // Un bloc publié peut avoir des ascensions : il ne se supprime pas.
    it('renvoie 409 sur un bloc publié', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({
        ...draft,
        status: BoulderStatus.PUBLIC,
      });

      await expect(service.deleteDraft(7, 99)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.boulder.deleteMany).not.toHaveBeenCalled();
    });

    it('renvoie 409 si le bloc a été publié entre-temps', async () => {
      prismaMock.boulder.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteDraft(7, 99)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
