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
};

// La forme minimale que findAll déréférence dans son mapping.
const boulderRow = {
  id: 10,
  name: 'Crimpy',
  grade: { vScale: 'V4', fontScale: '6B+', rank: 6 },
  creator: { username: 'seb' },
  angle: { valueDegrees: 40 },
  boulderTags: [{ tag: { name: 'Crimp', slug: 'crimp' } }],
  _count: { ascents: 3 },
  isPublic: true,
  createdAt: new Date(),
};

function findManyArg(): { where: Record<string, unknown> } {
  const [arg] = prismaMock.boulder.findMany.mock.calls[0] as [
    { where: Record<string, unknown> },
  ];
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
    prismaMock.boulder.findMany.mockResolvedValue([boulderRow]);
    prismaMock.boulder.count.mockResolvedValue(1);
    prismaMock.ascent.groupBy.mockResolvedValue([]);
  });

  describe('findAll — filtres', () => {
    // Le catalogue ne montre que le publié. Ces deux conditions ne dépendent
    // d'aucun filtre : une régression les rendrait invisibles, mais exposerait
    // les brouillons de tout le monde.
    it('exclut toujours les brouillons et les blocs privés', async () => {
      await service.findAll({});

      expect(findManyArg().where).toMatchObject({
        isPublic: true,
        isDraft: false,
      });
    });

    it("n'ajoute aucune condition quand aucun filtre nest fourni", async () => {
      await service.findAll({});

      expect(findManyArg().where).toEqual({ isPublic: true, isDraft: false });
    });

    it('filtre par angle', async () => {
      await service.findAll({ angle: 40 });

      expect(findManyArg().where).toMatchObject({
        angle: { valueDegrees: 40 },
      });
    });

    // Les deux bornes sont indépendantes : ne fournir qu'un minimum doit
    // produire un gte seul, pas une plage fermée sur une borne absente.
    it('accepte une borne de cotation seule', async () => {
      await service.findAll({ gradeMin: 5 });

      expect(findManyArg().where).toMatchObject({
        grade: { rank: { gte: 5 } },
      });
    });

    it('accepte les deux bornes de cotation', async () => {
      await service.findAll({ gradeMin: 5, gradeMax: 9 });

      expect(findManyArg().where).toMatchObject({
        grade: { rank: { gte: 5, lte: 9 } },
      });
    });

    it('cherche le nom et le créateur sans tenir compte de la casse', async () => {
      await service.findAll({ name: 'CRIMP', creator: 'Seb' });

      expect(findManyArg().where).toMatchObject({
        name: { contains: 'CRIMP', mode: 'insensitive' },
        creator: { username: { contains: 'Seb', mode: 'insensitive' } },
      });
    });

    // Plusieurs tags se cumulent en ET, pas en OU : demander « crimp + dyno »
    // doit rendre les blocs qui portent les deux. Un `some` avec un `in`
    // renverrait ceux qui portent l'un ou l'autre — la nuance ne se voit pas
    // en lisant le résultat, seulement en lisant la requête.
    it('cumule les tags en ET', async () => {
      await service.findAll({ tags: ['crimp', 'dyno'] });

      expect(findManyArg().where).toMatchObject({
        AND: [
          { boulderTags: { some: { tag: { slug: 'crimp' } } } },
          { boulderTags: { some: { tag: { slug: 'dyno' } } } },
        ],
      });
    });
  });

  describe('findAll — sortie', () => {
    it('projette le bloc sur le contrat du résumé', async () => {
      const { data } = await service.findAll({});

      expect(data[0]).toMatchObject({
        id: 10,
        name: 'Crimpy',
        gradeLabel: 'V4',
        gradeRank: 6,
        angleDegrees: 40,
        creatorUsername: 'seb',
        tags: ['crimp'],
        ascentCount: 3,
      });
    });

    // Aucune note ne doit donner null, pas 0 : une moyenne de 0 se lirait
    // comme « très mal noté » alors que personne n'a voté.
    it('renvoie null comme note moyenne quand personne na voté', async () => {
      const { data } = await service.findAll({});

      expect(data[0].averageRating).toBeNull();
    });

    it('associe chaque moyenne à son bloc', async () => {
      prismaMock.ascent.groupBy.mockResolvedValue([
        { boulderId: 10, _avg: { rating: 4.5 } },
      ]);

      const { data } = await service.findAll({});

      expect(data[0].averageRating).toBe(4.5);
    });

    it('calcule le nombre total de pages', async () => {
      prismaMock.boulder.count.mockResolvedValue(45);

      const { meta } = await service.findAll({ limit: 20 });

      expect(meta).toEqual({ total: 45, page: 1, limit: 20, totalPages: 3 });
    });
  });

  describe('findOne', () => {
    const detailRow = {
      ...boulderRow,
      description: 'Sloper exit',
      boulderHolds: [{ role: 'START', hold: { holdCode: 'A1', x: 10, y: 20 } }],
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

      expect(note).toMatchObject({ feltGradeLabel: null, likesCount: 2 });
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
            feltGrade: { vScale: 'V5' },
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
    // Le bloc a été créé à 40° (angleId 5) en V4.
    const likedBoulder = {
      id: 10,
      name: 'Crimpy',
      angleId: 5,
      grade: { vScale: 'V4', rank: 6 },
    };

    it('trie par like le plus récent et aplatit le bloc', async () => {
      const likedAt = new Date();
      prismaMock.boulderLike.findMany.mockResolvedValue([
        {
          createdAt: likedAt,
          angleId: 5,
          angle: { valueDegrees: 40 },
          boulder: likedBoulder,
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
          gradeLabel: 'V4',
          gradeRank: 6,
          angleDegrees: 40,
          likedAt,
        },
      ]);
    });

    // Liké à 50° : la carte rouvre le bloc à 50°, et n'affiche pas le V4 du
    // créateur, qui ne vaut qu'à 40°.
    it("renvoie l'inclinaison du like, sans cotation hors de celle du créateur", async () => {
      prismaMock.boulderLike.findMany.mockResolvedValue([
        {
          createdAt: new Date(),
          angleId: 7,
          angle: { valueDegrees: 50 },
          boulder: likedBoulder,
        },
      ]);

      const [like] = await service.findMyLikes(1);

      expect(like).toMatchObject({
        angleDegrees: 50,
        gradeLabel: null,
        gradeRank: null,
      });
    });
  });
});
