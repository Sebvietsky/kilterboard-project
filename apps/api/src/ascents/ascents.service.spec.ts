import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AscentsService } from './ascents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AscentStatus, Role } from '../generated/prisma/client';
import { CreateAscentDto } from './dto/create-ascent.dto';

// Ces tests couvrent les RÈGLES MÉTIER, pas Prisma : le client est mocké et on
// vérifie soit l'exception levée, soit le payload passé à `ascent.create`.
// Tester la persistance demanderait une vraie base — c'est le rôle des e2e.

const prismaMock = {
  boulder: { findUnique: jest.fn() },
  grade: { findUnique: jest.fn() },
  ascent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const user = { userId: 1, role: Role.USER, username: 'seb' };

// Un bloc valide : public et publié. Les cas d'accès sont testés à part.
const publicBoulder = { id: 10, isPublic: true, isDraft: false };

// Le DTO minimal qui passe : premier contact, grade ressenti fourni.
const baseDto: CreateAscentDto = {
  boulderId: 10,
  status: AscentStatus.SENT,
  feltGradeRank: 5,
};

// On relit l'argument réellement passé à Prisma plutôt que de composer des
// `expect.objectContaining` imbriqués : les matchers Jest sont typés `any`, et
// une assertion sur un objet typé se lit mieux qu'un matcher dans un matcher.
function writtenData(mock: jest.Mock): Record<string, unknown> {
  const [arg] = mock.mock.calls[0] as [{ data: Record<string, unknown> }];
  return arg.data;
}

describe('AscentsService', () => {
  let service: AscentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AscentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AscentsService);

    // Valeurs par défaut du chemin nominal ; chaque test surcharge ce qui le
    // concerne, pour qu'on lise dans le test la seule condition qu'il isole.
    prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);
    prismaMock.ascent.findMany.mockResolvedValue([]); // aucun historique
    prismaMock.grade.findUnique.mockResolvedValue({ id: 42, rank: 5 });
    prismaMock.ascent.create.mockResolvedValue({ id: 99 });
  });

  describe('create — accès au bloc', () => {
    it('rejette un bloc inexistant', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    // 404 et non 403 : révéler qu'un bloc privé existe est déjà une fuite.
    it.each([
      ['privé', { ...publicBoulder, isPublic: false }],
      ['brouillon', { ...publicBoulder, isDraft: true }],
    ])('rejette un bloc %s en 404', async (_label, boulder) => {
      prismaMock.boulder.findUnique.mockResolvedValue(boulder);

      await expect(service.create(baseDto, user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create — règle du flash', () => {
    const flashDto: CreateAscentDto = {
      ...baseDto,
      status: AscentStatus.FLASH,
      attemptsCount: 1,
    };

    it('accepte un flash en 1 essai au premier contact', async () => {
      await service.create(flashDto, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        status: AscentStatus.FLASH,
        attemptsCount: 1,
      });
    });

    it('déduit attemptsCount = 1 quand le client omet le compteur', async () => {
      await service.create(
        { boulderId: 10, status: AscentStatus.FLASH, feltGradeRank: 5 },
        user,
      );

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        attemptsCount: 1,
      });
    });

    // 0 compte autant que 5 : un flash sans essai n'existe pas.
    it.each([0, 2, 5])('rejette un flash annoncé en %i essai(s)', async (n) => {
      await expect(
        service.create({ ...flashDto, attemptsCount: n }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejette un flash sur un bloc où l'utilisateur a déjà une ascension", async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.SENT },
      ]);

      await expect(service.create(flashDto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    // Régression : un SENT en 1 essai était promu en FLASH juste avant
    // l'écriture, court-circuitant toutes les gardes ci-dessus. Le statut
    // validé doit être celui qu'on enregistre.
    it('ne promeut pas un SENT en 1 essai vers FLASH', async () => {
      await service.create({ ...baseDto, attemptsCount: 1 }, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        status: AscentStatus.SENT,
      });
    });
  });

  describe('create — projets', () => {
    const projectDto: CreateAscentDto = {
      boulderId: 10,
      status: AscentStatus.PROJECT,
    };

    it('rejette un second projet actif sur le même bloc', async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.PROJECT },
      ]);

      await expect(service.create(projectDto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([AscentStatus.FLASH, AscentStatus.SENT])(
      "rejette un %s tant qu'un projet est actif (à terminer via PATCH)",
      async (status) => {
        prismaMock.ascent.findMany.mockResolvedValue([
          { status: AscentStatus.PROJECT },
        ]);

        await expect(
          service.create({ ...baseDto, status, attemptsCount: 1 }, user),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it("laisse sendDate à null et n'exige pas de grade ressenti", async () => {
      await service.create(projectDto, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        sendDate: null,
        feltGradeId: null,
        wasProject: false,
      });
    });
  });

  describe('create — grade ressenti', () => {
    it.each([AscentStatus.FLASH, AscentStatus.SENT])(
      'exige un grade ressenti au premier %s',
      async (status) => {
        await expect(
          service.create({ boulderId: 10, status, attemptsCount: 1 }, user),
        ).rejects.toThrow(BadRequestException);
      },
    );

    // Le grade ressenti n'a de sens qu'au premier envoi : un repeat ne le rejoue pas.
    it("ne l'exige plus quand une ascension existe déjà", async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.SENT },
      ]);

      await expect(
        service.create({ boulderId: 10, status: AscentStatus.SENT }, user),
      ).resolves.toBeDefined();
    });

    it('rejette un rank inconnu', async () => {
      prismaMock.grade.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, feltGradeRank: 999 }, user),
      ).rejects.toThrow(BadRequestException);
    });

    // Le client envoie un rank (stable, lisible) ; la base stocke un id.
    it('résout le rank en Grade.id', async () => {
      await service.create(baseDto, user);

      expect(prismaMock.grade.findUnique).toHaveBeenCalledWith({
        where: { rank: 5 },
      });
      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        feltGradeId: 42,
      });
    });
  });

  describe('update', () => {
    const project = {
      id: 7,
      userId: user.userId,
      boulderId: 10,
      status: AscentStatus.PROJECT,
      feltGradeId: null,
      wasProject: false,
      sendDate: null,
    };

    beforeEach(() => {
      prismaMock.ascent.findUnique.mockResolvedValue(project);
      prismaMock.ascent.update.mockResolvedValue(project);
    });

    // Le flash atteste d'une réussite au premier contact avec le bloc : aucune
    // transition ultérieure ne peut produire ce fait.
    it('refuse tout passage à FLASH', async () => {
      await expect(
        service.update(7, { status: AscentStatus.FLASH }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('exige un grade ressenti pour terminer un projet en SENT', async () => {
      await expect(
        service.update(7, { status: AscentStatus.SENT }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepte le grade déjà présent sur l'ascension", async () => {
      prismaMock.ascent.findUnique.mockResolvedValue({
        ...project,
        feltGradeId: 42,
      });

      await expect(
        service.update(7, { status: AscentStatus.SENT }, user),
      ).resolves.toBeDefined();
    });

    it('marque wasProject et pose sendDate à la complétion', async () => {
      await service.update(
        7,
        { status: AscentStatus.SENT, feltGradeId: 42 },
        user,
      );

      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        wasProject: true,
        sendDate: expect.any(Date) as Date,
      });
    });

    it("rejette la modification de l'ascension d'un autre utilisateur", async () => {
      prismaMock.ascent.findUnique.mockResolvedValue({
        ...project,
        userId: 999,
      });

      await expect(
        service.update(7, { status: AscentStatus.SENT, feltGradeId: 42 }, user),
      ).rejects.toThrow();
    });
  });
});
