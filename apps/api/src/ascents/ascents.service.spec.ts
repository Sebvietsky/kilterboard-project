import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AscentsService } from './ascents.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { AscentStatus, Role } from '../generated/prisma/client';
import { CreateAscentDto } from './dto/create-ascent.dto';
import { recomputeAngleGrade } from '../boulders/community-grade';

// Le calcul de la cotation est testé dans community-grade.spec.ts. Ici on
// vérifie seulement QUAND l'ascension le déclenche.
jest.mock('../boulders/community-grade', () => ({
  recomputeAngleGrade: jest.fn(),
}));
const recomputeMock = jest.mocked(recomputeAngleGrade);

// Ces tests couvrent les RÈGLES MÉTIER, pas Prisma : le client est mocké et on
// vérifie soit l'exception levée, soit le payload passé à `ascent.create`.
// Tester la persistance demanderait une vraie base — c'est le rôle des e2e.

const prismaMock = {
  boulder: { findUnique: jest.fn() },
  grade: { findUnique: jest.fn() },
  angle: { findUnique: jest.fn() },
  ascent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  ascentNote: { findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

// Le client que reçoit le callback de la transaction. Un objet distinct de
// prismaMock, sinon un appel à `this.prisma` au lieu de `tx` passerait
// inaperçu. Ses fonctions sont celles de prismaMock : les écritures restent
// lisibles au même endroit, et `mock.contexts` dit par quel client elles sont
// passées. L'atomicité elle-même ne se prouve qu'en e2e.
const txMock = { ...prismaMock, ascent: { ...prismaMock.ascent } };

// La résolution de la session (implicite, explicite, zombie) appartient à
// SessionsService et y est testée. Ici on vérifie seulement ce que l'ascension
// en fait : ce qu'elle lui demande, et ce qu'elle écrit selon la réponse.
const sessionsMock = { resolveSessionId: jest.fn() };

const user = { userId: 1, role: Role.USER, username: 'seb' };

// Un bloc valide : public et publié. Les cas d'accès sont testés à part.
const publicBoulder = { id: 10, isPublic: true, isDraft: false };

// Le DTO minimal qui passe : premier contact, grade ressenti fourni.
const baseDto: CreateAscentDto = {
  boulderId: 10,
  angleDegrees: 40,
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
        { provide: SessionsService, useValue: sessionsMock },
      ],
    }).compile();

    service = module.get(AscentsService);

    // Valeurs par défaut du chemin nominal ; chaque test surcharge ce qui le
    // concerne, pour qu'on lise dans le test la seule condition qu'il isole.
    prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);
    prismaMock.ascent.findMany.mockResolvedValue([]); // aucun historique
    prismaMock.grade.findUnique.mockResolvedValue({ id: 42, rank: 5 });
    prismaMock.angle.findUnique.mockResolvedValue({ id: 7 }); // 40°
    prismaMock.ascent.create.mockResolvedValue({ id: 99 });
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
    );
    sessionsMock.resolveSessionId.mockResolvedValue(null); // hors session
  });

  describe('vote pour la cotation', () => {
    it.each([AscentStatus.SENT, AscentStatus.FLASH])(
      'recalcule la cotation au premier %s, dans la transaction',
      async (status) => {
        await service.create({ ...baseDto, status, attemptsCount: 1 }, user);

        // `toBe` et non `toHaveBeenCalledWith`, qui compare par contenu :
        // txMock a le même contenu que prismaMock, seule l'identité diffère.
        const [client, boulderId, angleId] = recomputeMock.mock.calls[0];
        expect(client).toBe(txMock);
        expect([boulderId, angleId]).toEqual([10, 7]);
        // Après l'écriture de l'ascension : sinon le nouveau vote n'est pas lu.
        expect(
          prismaMock.ascent.create.mock.invocationCallOrder[0],
        ).toBeLessThan(recomputeMock.mock.invocationCallOrder[0]);
      },
    );

    // Le vote et son recalcul dans la même transaction : l'ascension doit être
    // écrite par le client de la transaction, pas par le client global.
    it("écrit l'ascension par le client de la transaction", async () => {
      await service.create(baseDto, user);

      expect(prismaMock.ascent.create.mock.contexts[0]).toBe(txMock.ascent);
    });

    it("ne recalcule rien sur un envoi qui n'est pas le premier", async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.SENT },
      ]);

      await service.create(
        { boulderId: 10, angleDegrees: 40, status: AscentStatus.SENT },
        user,
      );

      expect(recomputeMock).not.toHaveBeenCalled();
    });

    it("ne recalcule rien sur l'ouverture d'un projet", async () => {
      await service.create(
        { boulderId: 10, angleDegrees: 40, status: AscentStatus.PROJECT },
        user,
      );

      expect(recomputeMock).not.toHaveBeenCalled();
    });

    // Si le recalcul échoue, l'ascension ne doit pas rester sans sa cotation :
    // l'erreur remonte de la transaction, qui annule tout.
    it('fait échouer le log quand le recalcul échoue', async () => {
      recomputeMock.mockRejectedValueOnce(new Error('lock timeout'));

      await expect(service.create(baseDto, user)).rejects.toThrow(
        'lock timeout',
      );
    });

    describe("à la complétion d'un projet", () => {
      const project = {
        id: 7,
        userId: user.userId,
        boulderId: 10,
        angleId: 3,
        status: AscentStatus.PROJECT,
        feltGradeId: null,
        wasProject: false,
        sendDate: null,
      };

      beforeEach(() => {
        prismaMock.ascent.findUnique.mockResolvedValue(project);
        prismaMock.ascent.update.mockResolvedValue(project);
      });

      it("recalcule la cotation à l'inclinaison du projet", async () => {
        await service.update(
          7,
          { status: AscentStatus.SENT, feltGradeRank: 5 },
          user,
        );

        const [client, boulderId, angleId] = recomputeMock.mock.calls[0];
        expect(client).toBe(txMock);
        expect([boulderId, angleId]).toEqual([10, 3]);
        expect(prismaMock.ascent.update.mock.contexts[0]).toBe(txMock.ascent);
      });

      it('ne recalcule rien sur une séance de projet', async () => {
        await service.update(7, { attemptsToAdd: 2 }, user);

        expect(recomputeMock).not.toHaveBeenCalled();
      });
    });
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

  describe('create — inclinaison', () => {
    it('rejette une inclinaison inconnue', async () => {
      prismaMock.angle.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, angleDegrees: 47 }, user),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.ascent.create).not.toHaveBeenCalled();
    });

    // Le client envoie des degrés ; la base stocke un id.
    it("résout les degrés en Angle.id et l'enregistre", async () => {
      await service.create(baseDto, user);

      expect(prismaMock.angle.findUnique).toHaveBeenCalledWith({
        where: { valueDegrees: 40 },
        select: { id: true },
      });
      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        angleId: 7,
      });
    });

    // C'est ce filtre qui rend toutes les règles « par inclinaison » : un
    // envoi à 45° n'est pas dans l'historique lu pour un log à 40°. Sans lui,
    // flash, projet et grade ressenti redeviendraient des règles par bloc.
    it("ne lit l'historique qu'à l'inclinaison demandée", async () => {
      await service.create(baseDto, user);

      const [arg] = prismaMock.ascent.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(arg.where).toEqual({ userId: 1, boulderId: 10, angleId: 7 });
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
        {
          boulderId: 10,
          angleDegrees: 40,
          status: AscentStatus.FLASH,
          feltGradeRank: 5,
        },
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

    // Sans grade ressenti, et assertion sur le message : avec un grade, le
    // refus du grade hors premier envoi levait la même exception, et le test
    // restait vert sans la règle du flash.
    it("rejette un flash sur un bloc où l'utilisateur a déjà une ascension", async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.SENT },
      ]);

      await expect(
        service.create({ ...flashDto, feltGradeRank: undefined }, user),
      ).rejects.toThrow(
        'Flash is only possible on your first ascent at this angle.',
      );
      expect(prismaMock.ascent.create).not.toHaveBeenCalled();
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
      angleDegrees: 40,
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

    // SENT seulement, sans grade ressenti : un FLASH est déjà refusé par la
    // règle du flash (le projet est une ascension), et un grade par celle du
    // grade ressenti. Le message dit quelle règle a refusé.
    it("rejette un SENT tant qu'un projet est actif (à terminer via PATCH)", async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.PROJECT },
      ]);

      await expect(
        service.create(
          { boulderId: 10, angleDegrees: 40, status: AscentStatus.SENT },
          user,
        ),
      ).rejects.toThrow('Complete it instead of logging a new ascent.');
      expect(prismaMock.ascent.create).not.toHaveBeenCalled();
    });

    it("laisse sendDate à null et n'exige pas de grade ressenti", async () => {
      await service.create(projectDto, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        sendDate: null,
        feltGradeId: null,
        wasProject: false,
      });
    });

    // B9 (décision du 2026-10-15) : un projet se travaille sur un bloc jamais
    // fait. Après un envoi à cette inclinaison, c'est un repeat.
    it.each([AscentStatus.SENT, AscentStatus.FLASH])(
      'refuse un projet après un %s à cette inclinaison',
      async (status) => {
        prismaMock.ascent.findMany.mockResolvedValue([{ status }]);

        await expect(service.create(projectDto, user)).rejects.toThrow(
          'A project can only be opened on your first ascent at this angle.',
        );
        expect(prismaMock.ascent.create).not.toHaveBeenCalled();
      },
    );

    // La première séance d'un projet : ses essais sont enregistrés à
    // l'ouverture, et consignés dans la session en cours. Les séances
    // suivantes passent par PATCH (attemptsToAdd), testé plus bas.
    it('ouvre un projet avec les essais de sa première séance', async () => {
      sessionsMock.resolveSessionId.mockResolvedValue(3);

      await service.create({ ...projectDto, attemptsCount: 6 }, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        status: AscentStatus.PROJECT,
        attemptsCount: 6,
        sessionEntries: {
          create: { sessionId: 3, status: AscentStatus.PROJECT, attempts: 6 },
        },
      });
    });
  });

  describe('create — note', () => {
    // B10 (décision du 2026-10-15) : la note se donne une fois, au premier
    // envoi, comme le grade ressenti. Sinon chaque repeat pèserait dans la
    // moyenne du bloc.
    it('enregistre la note du premier envoi', async () => {
      await service.create({ ...baseDto, rating: 4 }, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        rating: 4,
      });
    });

    it('refuse une note sur un envoi qui n’est pas le premier', async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.SENT },
      ]);

      await expect(
        service.create(
          {
            boulderId: 10,
            angleDegrees: 40,
            status: AscentStatus.SENT,
            rating: 5,
          },
          user,
        ),
      ).rejects.toThrow(
        'A rating can only be given on your first send at this angle.',
      );
      expect(prismaMock.ascent.create).not.toHaveBeenCalled();
    });

    it('refuse une note sur un projet', async () => {
      await expect(
        service.create(
          {
            boulderId: 10,
            angleDegrees: 40,
            status: AscentStatus.PROJECT,
            rating: 5,
          },
          user,
        ),
      ).rejects.toThrow(
        'A rating can only be given on your first send at this angle.',
      );
    });
  });

  describe('create — grade ressenti', () => {
    it.each([AscentStatus.FLASH, AscentStatus.SENT])(
      'exige un grade ressenti au premier %s',
      async (status) => {
        await expect(
          service.create(
            { boulderId: 10, angleDegrees: 40, status, attemptsCount: 1 },
            user,
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );

    // Le grade ressenti n'a de sens qu'au premier envoi : un repeat ne le rejoue pas.
    it("ne l'exige plus quand une ascension existe déjà", async () => {
      prismaMock.ascent.findMany.mockResolvedValue([
        { status: AscentStatus.SENT },
      ]);

      await expect(
        service.create(
          { boulderId: 10, angleDegrees: 40, status: AscentStatus.SENT },
          user,
        ),
      ).resolves.toBeDefined();
    });

    it('rejette un rank inconnu', async () => {
      prismaMock.grade.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, feltGradeRank: 999 }, user),
      ).rejects.toThrow(BadRequestException);
    });

    // Régression : le grade ressenti était exigé au premier envoi mais jamais
    // refusé ensuite. Un grimpeur pouvait voter plusieurs fois pour la
    // cotation d'un bloc à une inclinaison.
    it.each([AscentStatus.SENT, AscentStatus.REPEAT])(
      'refuse un grade ressenti sur un %s quand une ascension existe déjà',
      async (status) => {
        prismaMock.ascent.findMany.mockResolvedValue([
          { status: AscentStatus.SENT },
        ]);

        await expect(
          service.create({ ...baseDto, status }, user),
        ).rejects.toThrow(BadRequestException);
        expect(prismaMock.ascent.create).not.toHaveBeenCalled();
      },
    );

    it('refuse un grade ressenti sur un projet', async () => {
      await expect(
        service.create(
          { ...baseDto, status: AscentStatus.PROJECT, feltGradeRank: 5 },
          user,
        ),
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

  describe('create — passage dans la session', () => {
    // Les trois valeurs ont un sens différent : le service ne doit en
    // normaliser aucune avant de les transmettre (un `?? null` suffirait à
    // transformer « rattache-moi » en « hors session »).
    it.each([
      ['absent', undefined],
      ['null explicite', null],
      ['un id', 7],
    ])('transmet sessionId tel quel : %s', async (_label, sessionId) => {
      await service.create({ ...baseDto, sessionId }, user);

      expect(sessionsMock.resolveSessionId).toHaveBeenCalledWith(
        sessionId,
        user.userId,
      );
    });

    it('consigne un passage quand une session est résolue', async () => {
      sessionsMock.resolveSessionId.mockResolvedValue(7);

      await service.create({ ...baseDto, attemptsCount: 3 }, user);

      expect(writtenData(prismaMock.ascent.create)).toMatchObject({
        sessionEntries: {
          create: { sessionId: 7, status: AscentStatus.SENT, attempts: 3 },
        },
      });
    });

    it("n'écrit aucun passage hors session", async () => {
      await service.create(baseDto, user);

      expect(writtenData(prismaMock.ascent.create)).not.toHaveProperty(
        'sessionEntries',
      );
    });

    // Session d'un autre, terminée ou inexistante : l'erreur vient de
    // SessionsService et doit empêcher toute écriture.
    it("ne crée pas l'ascension quand la session est refusée", async () => {
      sessionsMock.resolveSessionId.mockRejectedValue(
        new ConflictException('Session is already ended.'),
      );

      await expect(
        service.create({ ...baseDto, sessionId: 7 }, user),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.ascent.create).not.toHaveBeenCalled();
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

    // Cahier des charges §4.2 : un projet ne sort que vers SENT, et seul un
    // projet se supprime. Liste blanche : toute autre transition est refusée.
    // 400 quand la demande ne peut jamais réussir, 409 quand elle aurait
    // réussi sur un projet : le client relit alors l'état au lieu de
    // réessayer (renvoi d'une complétion dont la réponse s'est perdue).
    describe('transitions de statut', () => {
      const sentAs = (status: AscentStatus) => ({
        ...project,
        status,
        feltGradeId: 42,
        sendDate: new Date(),
      });

      function expectNothingWritten() {
        expect(prismaMock.ascent.update).not.toHaveBeenCalled();
        expect(recomputeMock).not.toHaveBeenCalled();
      }

      // B1 : un envoi repassé en projet pouvait être supprimé, et son vote
      // avec, sans recalcul de la cotation.
      it.each([AscentStatus.SENT, AscentStatus.FLASH])(
        'refuse en 400 de repasser un %s en projet',
        async (status) => {
          prismaMock.ascent.findUnique.mockResolvedValue(sentAs(status));

          await expect(
            service.update(7, { status: AscentStatus.PROJECT }, user),
          ).rejects.toThrow(BadRequestException);
          expectNothingWritten();
        },
      );

      // B2 : terminer un projet en REPEAT contournait le grade ressenti exigé
      // à la complétion.
      it('refuse en 400 de terminer un projet en REPEAT', async () => {
        await expect(
          service.update(7, { status: AscentStatus.REPEAT }, user),
        ).rejects.toThrow(BadRequestException);
        expectNothingWritten();
      });

      // Avec le grade : c'est la forme exacte d'une complétion renvoyée. Le
      // 409 doit l'emporter sur le refus du grade hors complétion (400).
      it.each([
        [AscentStatus.SENT, 'sans grade', {}],
        [AscentStatus.SENT, 'avec grade', { feltGradeRank: 5 }],
        [AscentStatus.FLASH, 'avec grade', { feltGradeRank: 5 }],
      ])(
        'refuse en 409 de terminer un %s déjà envoyé (%s)',
        async (status, _label, extra) => {
          prismaMock.ascent.findUnique.mockResolvedValue(sentAs(status));

          await expect(
            service.update(
              7,
              { status: AscentStatus.SENT, attemptsToAdd: 2, ...extra },
              user,
            ),
          ).rejects.toThrow(ConflictException);
          expectNothingWritten();
        },
      );

      // B3 : une séance se consigne sur un projet (décision du 2026-10-09).
      // Sur un envoi, elle gonflait ses essais et son nombre de séances.
      it.each([AscentStatus.SENT, AscentStatus.FLASH])(
        'refuse en 409 une séance sur un %s',
        async (status) => {
          prismaMock.ascent.findUnique.mockResolvedValue(sentAs(status));

          await expect(
            service.update(7, { attemptsToAdd: 3 }, user),
          ).rejects.toThrow(ConflictException);
          expectNothingWritten();
        },
      );
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

    it('marque wasProject et pose sendDate à la complétion', async () => {
      await service.update(
        7,
        { status: AscentStatus.SENT, feltGradeRank: 5 },
        user,
      );

      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        wasProject: true,
        sendDate: expect.any(Date) as Date,
      });
    });

    // Les essais consignés sont ceux de la séance, pas le cumul du projet : le
    // compte rendu d'une session dit ce qui s'y est passé.
    it('consigne une séance de projet dans la session en cours', async () => {
      sessionsMock.resolveSessionId.mockResolvedValue(3);

      await service.update(7, { attemptsToAdd: 4 }, user);

      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        sessionEntries: {
          create: { sessionId: 3, status: AscentStatus.PROJECT, attempts: 4 },
        },
      });
    });

    it('consigne la complétion avec le statut SENT', async () => {
      sessionsMock.resolveSessionId.mockResolvedValue(3);

      await service.update(
        7,
        { status: AscentStatus.SENT, feltGradeRank: 5 },
        user,
      );

      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        sessionEntries: {
          create: { sessionId: 3, status: AscentStatus.SENT, attempts: 0 },
        },
      });
    });

    it("n'écrit aucun passage hors session", async () => {
      await service.update(7, { attemptsToAdd: 4 }, user);

      expect(writtenData(prismaMock.ascent.update)).not.toHaveProperty(
        'sessionEntries',
      );
    });

    // B10 (décision du 2026-10-15) : la note se donne une fois, au premier
    // envoi, comme le grade ressenti. En PATCH, seulement à la complétion.
    it.each([
      ['une séance de projet', { rating: 4, attemptsToAdd: 2 }, project],
      [
        'un envoi déjà enregistré',
        { rating: 4 },
        { ...project, status: AscentStatus.SENT, feltGradeId: 42 },
      ],
    ])('refuse une note sur %s', async (_label, dto, ascent) => {
      prismaMock.ascent.findUnique.mockResolvedValue(ascent);

      await expect(service.update(7, dto, user)).rejects.toThrow(
        'A rating can only be given on your first send at this angle.',
      );
      expect(prismaMock.ascent.update).not.toHaveBeenCalled();
    });

    it('enregistre la note donnée à la complétion', async () => {
      await service.update(
        7,
        { status: AscentStatus.SENT, feltGradeRank: 5, rating: 4 },
        user,
      );

      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        rating: 4,
      });
    });

    // Le client raisonne en rangs, comme sur POST /ascents ; la base stocke
    // un id. Les deux routes divergeaient avant ce contrat commun.
    it('résout feltGradeRank en Grade.id', async () => {
      await service.update(
        7,
        { status: AscentStatus.SENT, feltGradeRank: 5 },
        user,
      );

      expect(prismaMock.grade.findUnique).toHaveBeenCalledWith({
        where: { rank: 5 },
      });
      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        feltGradeId: 42,
      });
    });

    it('rejette un rank inconnu', async () => {
      prismaMock.grade.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          7,
          { status: AscentStatus.SENT, feltGradeRank: 999 },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // Le vote se donne une fois, à la complétion du projet. Ni une séance de
    // projet, ni un envoi déjà enregistré ne peuvent en porter un second.
    it.each([
      ['une séance de projet', { feltGradeRank: 5, attemptsToAdd: 2 }, project],
      [
        'un envoi déjà enregistré',
        { feltGradeRank: 5 },
        { ...project, status: AscentStatus.SENT, feltGradeId: 42 },
      ],
      [
        'un REPEAT',
        { feltGradeRank: 5 },
        { ...project, status: AscentStatus.REPEAT },
      ],
    ])('refuse un grade ressenti sur %s', async (_label, dto, ascent) => {
      prismaMock.ascent.findUnique.mockResolvedValue(ascent);

      await expect(service.update(7, dto, user)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.ascent.update).not.toHaveBeenCalled();
    });

    // Le client envoie les essais de SA séance ; le serveur additionne. Un
    // increment Prisma et non une valeur calculée côté service : deux séances
    // enregistrées en même temps depuis deux appareils s'additionnent au lieu
    // de s'écraser.
    it('additionne les essais de la séance au lieu de les remplacer', async () => {
      await service.update(7, { attemptsToAdd: 3 }, user);

      expect(writtenData(prismaMock.ascent.update)).toMatchObject({
        attemptsCount: { increment: 3 },
        sessionsCount: { increment: 1 },
      });
    });

    // Enregistrer une séance sans clore le projet : le statut n'est pas touché
    // et la date d'envoi reste nulle.
    it('garde le projet ouvert quand aucun statut nest fourni', async () => {
      await service.update(7, { attemptsToAdd: 2 }, user);

      const data = writtenData(prismaMock.ascent.update);
      expect(data.status).toBeUndefined();
      expect(data.sendDate).toBeNull();
    });

    // Régression : le service déversait `...dto` dans Prisma. attemptsToAdd et
    // feltGradeRank ne sont pas des colonnes — les laisser passer ferait
    // échouer l'appel à l'exécution, sans que tsc puisse le voir.
    it("n'envoie à Prisma aucun champ du DTO qui ne soit pas une colonne", async () => {
      await service.update(
        7,
        { status: AscentStatus.SENT, feltGradeRank: 5, attemptsToAdd: 2 },
        user,
      );

      const data = writtenData(prismaMock.ascent.update);
      expect(data).not.toHaveProperty('feltGradeRank');
      expect(data).not.toHaveProperty('attemptsToAdd');
    });

    it("rejette la modification de l'ascension d'un autre utilisateur", async () => {
      prismaMock.ascent.findUnique.mockResolvedValue({
        ...project,
        userId: 999,
      });

      await expect(
        service.update(
          7,
          { status: AscentStatus.SENT, feltGradeRank: 5 },
          user,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.ascent.update).not.toHaveBeenCalled();
    });
  });

  // Les ascensions et leurs notes privées n'appartiennent qu'à leur auteur :
  // le filtre sur l'utilisateur est la seule chose qui l'assure.
  describe('lecture de mes ascensions', () => {
    beforeEach(() => {
      prismaMock.ascent.count.mockResolvedValue(0);
    });

    it("ne lit que les ascensions de l'utilisateur, et le total aussi", async () => {
      await service.findMyAscents(user.userId, {});

      const [list] = prismaMock.ascent.findMany.mock.calls[0] as [
        { where: unknown },
      ];
      const [count] = prismaMock.ascent.count.mock.calls[0] as [
        { where: unknown },
      ];
      expect(list.where).toEqual({ userId: user.userId });
      expect(count.where).toEqual({ userId: user.userId });
    });

    // Le même bloc n'a pas la même cotation à deux inclinaisons : celle du
    // créateur ne vaut qu'à la sienne. Prisma étant mocké, seule la forme de
    // la requête dit quelle cotation part au client.
    it("lit la cotation à l'inclinaison de l'ascension, pas celle du créateur", async () => {
      await service.findMyAscents(user.userId, {});

      const [list] = prismaMock.ascent.findMany.mock.calls[0] as [
        {
          include: {
            boulder: { select: Record<string, unknown> };
            boulderAngle?: { select: { grade?: unknown } };
          };
        },
      ];
      expect(list.include.boulderAngle?.select.grade).toBeDefined();
      expect(list.include.boulder.select).not.toHaveProperty('grade');
    });

    // L'historique affiche la date d'envoi : trier par création mélangerait
    // les projets complétés (créés bien avant leur envoi) avec le reste.
    it("trie par date d'envoi, projets ouverts en tête", async () => {
      await service.findMyAscents(user.userId, {});

      const [list] = prismaMock.ascent.findMany.mock.calls[0] as [
        { orderBy: unknown },
      ];
      expect(list.orderBy).toEqual([
        { sendDate: { sort: 'desc', nulls: 'first' } },
        { createdAt: 'desc' },
      ]);
    });

    it("ne lit sur un bloc que les ascensions de l'utilisateur", async () => {
      await service.findMyAscentOnBoulder(user.userId, 10);

      const [arg] = prismaMock.ascent.findMany.mock.calls[0] as [
        { where: unknown },
      ];
      expect(arg.where).toEqual({ userId: user.userId, boulderId: 10 });
    });
  });

  describe('remove', () => {
    // Un envoi est un fait consigné dans le logbook : on ne l'efface pas.
    // Un projet, lui, n'est qu'une intention — l'abandonner est légitime.
    it.each([AscentStatus.SENT, AscentStatus.FLASH])(
      'refuse de supprimer une ascension au statut %s',
      async (status) => {
        prismaMock.ascent.findUnique.mockResolvedValue({
          id: 7,
          userId: user.userId,
          status,
        });

        await expect(service.remove(7, user)).rejects.toThrow(
          BadRequestException,
        );
        expect(prismaMock.ascent.delete).not.toHaveBeenCalled();
      },
    );

    it('supprime un projet abandonné', async () => {
      prismaMock.ascent.findUnique.mockResolvedValue({
        id: 7,
        userId: user.userId,
        status: AscentStatus.PROJECT,
      });

      await service.remove(7, user);

      expect(prismaMock.ascent.delete).toHaveBeenCalledWith({
        where: { id: 7 },
      });
    });

    it("rejette l'ascension d'un autre utilisateur", async () => {
      prismaMock.ascent.findUnique.mockResolvedValue({
        id: 7,
        userId: 999,
        status: AscentStatus.PROJECT,
      });

      await expect(service.remove(7, user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createNote', () => {
    // Premier envoi à cette inclinaison : il porte le vote.
    const sentAscent = {
      id: 7,
      userId: user.userId,
      boulderId: 10,
      angleId: 7,
      status: AscentStatus.SENT,
      feltGradeId: 42,
    };

    beforeEach(() => {
      prismaMock.ascent.findUnique.mockResolvedValue(sentAscent);
      prismaMock.ascentNote.findFirst.mockResolvedValue(null);
      prismaMock.ascentNote.create.mockResolvedValue({ id: 1 });
    });

    it('attache la note au bloc de son ascension', async () => {
      await service.createNote(
        7,
        { content: 'Beta: talon droit', visibility: 'PUBLIC' },
        user,
      );

      expect(writtenData(prismaMock.ascentNote.create)).toMatchObject({
        ascentId: 7,
        userId: user.userId,
        boulderId: sentAscent.boulderId,
        visibility: 'PUBLIC',
      });
    });

    // Règle du cahier des charges : le commentaire public appartient au premier
    // envoi. Un REPEAT n'a droit qu'à une note privée — sinon un même grimpeur
    // occuperait les commentaires d'un bloc à chaque re-grimpe.
    it.each([AscentStatus.PROJECT, AscentStatus.REPEAT])(
      'refuse une note publique sur une ascension au statut %s',
      async (status) => {
        prismaMock.ascent.findUnique.mockResolvedValue({
          ...sentAscent,
          status,
        });

        await expect(
          service.createNote(7, { content: 'x', visibility: 'PUBLIC' }, user),
        ).rejects.toThrow(BadRequestException);
      },
    );

    // B7 : un second SENT à la même inclinaison est un repeat (décision du
    // 2026-10-15). Il ne porte pas de vote, et pas d'évaluation publique non
    // plus, même si le premier envoi n'en avait pas.
    describe("sur un envoi qui n'est pas le premier", () => {
      const repeatSend = { ...sentAscent, feltGradeId: null };

      beforeEach(() => {
        prismaMock.ascent.findUnique.mockResolvedValue(repeatSend);
      });

      it('refuse une note publique', async () => {
        await expect(
          service.createNote(7, { content: 'x', visibility: 'PUBLIC' }, user),
        ).rejects.toThrow(
          'Public notes are only allowed on your first SENT or FLASH ascent.',
        );
        expect(prismaMock.ascentNote.create).not.toHaveBeenCalled();
      });

      it('autorise une note privée', async () => {
        await expect(
          service.createNote(7, { content: 'x', visibility: 'PRIVATE' }, user),
        ).resolves.toBeDefined();
      });
    });

    it.each([AscentStatus.PROJECT, AscentStatus.REPEAT])(
      'autorise une note privée sur une ascension au statut %s',
      async (status) => {
        prismaMock.ascent.findUnique.mockResolvedValue({
          ...sentAscent,
          status,
        });

        await expect(
          service.createNote(7, { content: 'x', visibility: 'PRIVATE' }, user),
        ).resolves.toBeDefined();
      },
    );

    // L'unicité porte sur (user, bloc, inclinaison), pas sur l'ascension :
    // sans ça, deux ascensions du même grimpeur sur un bloc à la même
    // inclinaison lui donneraient deux voix. Une autre inclinaison, elle,
    // se commente à part.
    it('refuse une seconde note publique sur le même bloc à la même inclinaison', async () => {
      prismaMock.ascentNote.findFirst.mockResolvedValue({ id: 99 });

      await expect(
        service.createNote(7, { content: 'x', visibility: 'PUBLIC' }, user),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.ascentNote.findFirst).toHaveBeenCalledWith({
        where: {
          userId: user.userId,
          boulderId: sentAscent.boulderId,
          visibility: 'PUBLIC',
          ascent: { angleId: sentAscent.angleId },
        },
      });
    });

    // La note privée n'est pas concernée par l'unicité : on peut en poser une
    // par ascension.
    it('ne vérifie pas lunicité pour une note privée', async () => {
      await service.createNote(
        7,
        { content: 'x', visibility: 'PRIVATE' },
        user,
      );

      expect(prismaMock.ascentNote.findFirst).not.toHaveBeenCalled();
    });

    it("rejette une note sur l'ascension d'un autre utilisateur", async () => {
      prismaMock.ascent.findUnique.mockResolvedValue({
        ...sentAscent,
        userId: 999,
      });

      await expect(
        service.createNote(7, { content: 'x', visibility: 'PRIVATE' }, user),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
