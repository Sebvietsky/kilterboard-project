import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/client';

const prismaMock = {
  boardSession: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const user = { userId: 1, role: Role.USER, username: 'seb' };

function writtenData(mock: jest.Mock): Record<string, unknown> {
  const [arg] = mock.mock.calls[0] as [{ data: Record<string, unknown> }];
  return arg.data;
}

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(SessionsService);
    prismaMock.boardSession.create.mockResolvedValue({ id: 1 });
    prismaMock.boardSession.update.mockResolvedValue({ id: 1 });
  });

  describe('startSession', () => {
    // Règle du cahier des charges : une session est active tant que endedAt est
    // NULL, et un utilisateur ne peut en avoir qu'une. Un index partiel unique
    // la garantit en base ; ce test couvre le message d'erreur applicatif, qui
    // vaut mieux qu'une violation de contrainte remontée brute.
    it('refuse une seconde session tant que la première est ouverte', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue({ id: 42 });

      await expect(service.startSession({}, user)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.boardSession.create).not.toHaveBeenCalled();
    });

    it("cherche l'existence d'une session ouverte sur endedAt: null", async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await service.startSession({}, user);

      expect(prismaMock.boardSession.findFirst).toHaveBeenCalledWith({
        where: { userId: user.userId, endedAt: null },
      });
    });

    it('démarre la session quand aucune nest ouverte', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await service.startSession({ boardId: 3, note: 'warmup' }, user);

      expect(writtenData(prismaMock.boardSession.create)).toMatchObject({
        userId: user.userId,
        boardId: 3,
        note: 'warmup',
        startedAt: expect.any(Date) as Date,
      });
    });

    // Le titre est optionnel côté client : sans lui, une session reste
    // identifiable dans la liste plutôt que d'apparaître sans nom.
    it('génère un titre daté quand le client nen fournit pas', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await service.startSession({}, user);

      expect(writtenData(prismaMock.boardSession.create).title).toEqual(
        expect.stringMatching(/^Session du \d{2}\/\d{2}\/\d{4}$/),
      );
    });

    it('conserve le titre fourni', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await service.startSession({ title: 'Projet du soir' }, user);

      expect(writtenData(prismaMock.boardSession.create)).toMatchObject({
        title: 'Projet du soir',
      });
    });
  });

  describe('endSession', () => {
    const openSession = {
      id: 7,
      userId: user.userId,
      endedAt: null,
      note: 'a',
    };

    it('clôture une session ouverte en posant endedAt', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue(openSession);

      await service.endSession(7, {}, user);

      expect(writtenData(prismaMock.boardSession.update)).toMatchObject({
        endedAt: expect.any(Date) as Date,
      });
    });

    // Clôturer deux fois écraserait la date de fin réelle par celle du second
    // appel — un doublon de requête suffirait à fausser la durée de la séance.
    it('refuse de clôturer une session déjà terminée', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue({
        ...openSession,
        endedAt: new Date(),
      });

      await expect(service.endSession(7, {}, user)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.boardSession.update).not.toHaveBeenCalled();
    });

    it('conserve la note existante quand la clôture nen fournit pas', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue(openSession);

      await service.endSession(7, {}, user);

      expect(writtenData(prismaMock.boardSession.update)).toMatchObject({
        note: 'a',
      });
    });

    it('rejette une session inexistante', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue(null);

      await expect(service.endSession(7, {}, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejette la session d'un autre utilisateur", async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue({
        ...openSession,
        userId: 999,
      });

      await expect(service.endSession(7, {}, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
