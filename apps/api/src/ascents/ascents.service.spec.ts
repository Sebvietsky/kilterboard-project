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
    delete: jest.fn(),
  },
  ascentNote: { findFirst: jest.fn(), create: jest.fn() },
};

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
    prismaMock.ascent.create.mockResolvedValue({ id: 99 });
    sessionsMock.resolveSessionId.mockResolvedValue(null); // hors session
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

    // Changer une note n'est pas grimper : rien à consigner, et la session
    // n'est même pas consultée.
    it('ne consigne rien sur une simple modification de note', async () => {
      sessionsMock.resolveSessionId.mockResolvedValue(3);

      await service.update(7, { rating: 4 }, user);

      expect(sessionsMock.resolveSessionId).not.toHaveBeenCalled();
      expect(writtenData(prismaMock.ascent.update)).not.toHaveProperty(
        'sessionEntries',
      );
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
      ).rejects.toThrow();
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
    const sentAscent = {
      id: 7,
      userId: user.userId,
      boulderId: 10,
      status: AscentStatus.SENT,
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

    // L'unicité porte sur (user, bloc), pas sur l'ascension : sans ça, deux
    // ascensions du même grimpeur sur un bloc lui donneraient deux voix.
    it('refuse une seconde note publique sur le même bloc', async () => {
      prismaMock.ascentNote.findFirst.mockResolvedValue({ id: 99 });

      await expect(
        service.createNote(7, { content: 'x', visibility: 'PUBLIC' }, user),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.ascentNote.findFirst).toHaveBeenCalledWith({
        where: {
          userId: user.userId,
          boulderId: sentAscent.boulderId,
          visibility: 'PUBLIC',
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
