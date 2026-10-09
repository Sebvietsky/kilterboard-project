import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  SESSION_INACTIVITY_LIMIT_MS,
  SessionsService,
} from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '../generated/prisma/client';

const prismaMock = {
  boardSession: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const user = { userId: 1, role: Role.USER, username: 'seb' };

// Forme renvoyée par la recherche de la session ouverte : son début et son
// dernier passage, de quoi dater la dernière activité.
function openSessionRow(startedAt: Date, lastEntryAt?: Date) {
  return {
    id: 42,
    startedAt,
    entries: lastEntryAt ? [{ createdAt: lastEntryAt }] : [],
  };
}

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000);
const LIMIT_MINUTES = SESSION_INACTIVITY_LIMIT_MS / 60_000;

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
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(minutesAgo(10)),
      );

      await expect(service.startSession({}, user)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.boardSession.create).not.toHaveBeenCalled();
    });

    // Avant la fermeture automatique, une session oubliée bloquait tout
    // nouveau Start indéfiniment (deux mois, lors du test du 2026-09-29).
    it('ferme une session oubliée et laisse démarrer la nouvelle', async () => {
      const startedAt = minutesAgo(LIMIT_MINUTES + 1);
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(startedAt),
      );

      await service.startSession({}, user);

      expect(prismaMock.boardSession.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { endedAt: startedAt },
      });
      expect(prismaMock.boardSession.create).toHaveBeenCalled();
    });

    // Course entre deux Start simultanés (double tap, retry réseau) : les deux
    // findFirst ne voient rien, et c'est l'index partiel unique qui rejette le
    // second create. Le service ne doit pas avaler cette erreur : remontée
    // telle quelle, PrismaExceptionFilter la traduit en 409. Prisma étant
    // mocké, ce test ne prouve pas l'index lui-même — seulement ce chemin.
    it("laisse remonter la violation d'unicité quand l'index rejette la création", async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);
      prismaMock.boardSession.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
        }),
      );

      await expect(service.startSession({}, user)).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it("cherche l'existence d'une session ouverte sur endedAt: null", async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await service.startSession({}, user);

      expect(prismaMock.boardSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: user.userId, endedAt: null },
        }),
      );
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
      startedAt: minutesAgo(10),
      entries: [],
    };

    it('clôture une session ouverte en posant endedAt', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue(openSession);

      await service.endSession(7, {}, user);

      expect(writtenData(prismaMock.boardSession.update)).toMatchObject({
        endedAt: expect.any(Date) as Date,
      });
    });

    // Écran resté ouvert toute la nuit, End tapé le lendemain : la durée ne
    // doit pas inclure la nuit.
    it('date un End tardif à la dernière activité', async () => {
      const lastEntryAt = minutesAgo(LIMIT_MINUTES + 30);
      prismaMock.boardSession.findUnique.mockResolvedValue({
        ...openSession,
        startedAt: minutesAgo(LIMIT_MINUTES * 3),
        entries: [{ createdAt: lastEntryAt }],
      });

      await service.endSession(7, {}, user);

      expect(writtenData(prismaMock.boardSession.update)).toMatchObject({
        endedAt: lastEntryAt,
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

  describe('getActiveSession — fermeture des sessions oubliées', () => {
    beforeEach(() => {
      prismaMock.boardSession.findUnique.mockResolvedValue({ id: 42 });
    });

    it("renvoie null quand aucune session n'est ouverte", async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await expect(service.getActiveSession(user.userId)).resolves.toBeNull();
      expect(prismaMock.boardSession.findUnique).not.toHaveBeenCalled();
    });

    it('renvoie la session quand le dernier passage est récent', async () => {
      // Session commencée il y a longtemps, mais un bloc loggé il y a 10 min :
      // c'est l'inactivité qui compte, pas la durée.
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(minutesAgo(LIMIT_MINUTES * 3), minutesAgo(10)),
      );

      await expect(service.getActiveSession(user.userId)).resolves.toEqual({
        id: 42,
      });
      expect(prismaMock.boardSession.update).not.toHaveBeenCalled();
    });

    it('ferme la session à la date du dernier passage, pas à maintenant', async () => {
      const lastEntryAt = minutesAgo(LIMIT_MINUTES + 30);
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(minutesAgo(LIMIT_MINUTES * 3), lastEntryAt),
      );

      await expect(service.getActiveSession(user.userId)).resolves.toBeNull();
      expect(prismaMock.boardSession.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { endedAt: lastEntryAt },
      });
    });

    it('sans aucun passage, se replie sur le début de la session', async () => {
      const startedAt = minutesAgo(LIMIT_MINUTES + 30);
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(startedAt),
      );

      await service.getActiveSession(user.userId);

      expect(prismaMock.boardSession.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { endedAt: startedAt },
      });
    });
  });

  describe('resolveSessionId', () => {
    const ownOpenSession = { id: 7, userId: user.userId, endedAt: null };

    it('résout la session en cours quand sessionId est absent', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(minutesAgo(10)),
      );

      await expect(
        service.resolveSessionId(undefined, user.userId),
      ).resolves.toBe(42);
    });

    it('renvoie null quand sessionId est absent et aucune session en cours', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveSessionId(undefined, user.userId),
      ).resolves.toBeNull();
    });

    // Une session oubliée ne doit pas absorber un bloc loggé le lendemain.
    it('ne rattache pas à une session oubliée', async () => {
      prismaMock.boardSession.findFirst.mockResolvedValue(
        openSessionRow(minutesAgo(LIMIT_MINUTES + 1)),
      );

      await expect(
        service.resolveSessionId(undefined, user.userId),
      ).resolves.toBeNull();
    });

    // Le cas qui justifie de distinguer `null` de `undefined` : une session
    // est en cours, et le client demande quand même à logger en dehors.
    it('renvoie null sur un null explicite, sans chercher de session', async () => {
      await expect(
        service.resolveSessionId(null, user.userId),
      ).resolves.toBeNull();
      expect(prismaMock.boardSession.findFirst).not.toHaveBeenCalled();
    });

    it('accepte la session demandée si elle est à soi et ouverte', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue(ownOpenSession);

      await expect(service.resolveSessionId(7, user.userId)).resolves.toBe(7);
    });

    it('rejette une session inexistante', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue(null);

      await expect(service.resolveSessionId(7, user.userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejette la session d'un autre utilisateur", async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue({
        ...ownOpenSession,
        userId: 2,
      });

      await expect(service.resolveSessionId(7, user.userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejette une session déjà terminée', async () => {
      prismaMock.boardSession.findUnique.mockResolvedValue({
        ...ownOpenSession,
        endedAt: new Date(),
      });

      await expect(service.resolveSessionId(7, user.userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
