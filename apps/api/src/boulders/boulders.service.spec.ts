import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BouldersService } from './boulders.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  boulder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  ascent: { groupBy: jest.fn(), aggregate: jest.fn() },
  ascentNote: { findMany: jest.fn() },
  boulderLike: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  angle: { findUnique: jest.fn() },
  boulderAngle: { findMany: jest.fn(), count: jest.fn() },
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
  isPublic: true,
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
    it('exclut toujours les brouillons et les blocs privés', async () => {
      await service.findAll({ angle: 40 });

      expect(findManyArg().where.boulder).toMatchObject({
        isPublic: true,
        isDraft: false,
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
        boulder: { isPublic: true, isDraft: false },
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
    // bloc privé n'est pas trouvé du tout, donc 404 et non 403 — révéler qu'il
    // existe serait déjà une fuite.
    it('ne cherche que parmi les blocs publics et publiés', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(detailRow);

      await service.findOne(10);

      expect(prismaMock.boulder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10, isPublic: true, isDraft: false },
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
    // Boulder porte creatorId, pas userId : assertOwnerShip reçoit un objet
    // adapté. Une inversion ici laisserait n'importe qui publier le brouillon
    // d'un autre.
    it('publie le brouillon de son créateur', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10, creatorId: 1 });

      await service.publishBoulder(10, 1);

      expect(prismaMock.boulder.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { isDraft: false, isPublic: true },
      });
    });

    it("refuse de publier le bloc d'un autre", async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10, creatorId: 1 });

      await expect(service.publishBoulder(10, 999)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.boulder.update).not.toHaveBeenCalled();
    });

    it('rejette un bloc inexistant', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.publishBoulder(10, 1)).rejects.toThrow(
        NotFoundException,
      );
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
      expect(arg.where).toMatchObject({ isPublic: true, isDraft: false });
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
});
