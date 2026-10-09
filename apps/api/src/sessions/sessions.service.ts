import { Injectable, ConflictException } from '@nestjs/common';
import { assertFound, assertOwnerShip } from '../common/utils/ownership.utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { JwtPayload } from '../common/interfaces/auth-payload.interface';

// Au-delà de ce délai sans aucun bloc loggé, une session ouverte est
// considérée comme oubliée et fermée par le serveur.
export const SESSION_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;

// De quoi dater la dernière activité d'une session : son début et son dernier
// passage. À demander dans tout `select`/`include` qui doit juger de sa fraîcheur.
const LAST_ENTRY = {
  select: { createdAt: true },
  orderBy: { createdAt: 'desc' },
  take: 1,
} as const;

type SessionActivity = { startedAt: Date; entries: { createdAt: Date }[] };

function lastActivityOf(session: SessionActivity): Date {
  return session.entries[0]?.createdAt ?? session.startedAt;
}

function isStale(session: SessionActivity): boolean {
  return (
    Date.now() - lastActivityOf(session).getTime() > SESSION_INACTIVITY_LIMIT_MS
  );
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Session réellement en cours de l'utilisateur, ou `null`.
   *
   * Ferme au passage une session oubliée (« zombie »). Fermeture paresseuse et
   * non cron : elle a lieu ici, donc avant toute réponse qui dépend de l'état
   * de la session — Start, lecture, log d'une ascension. L'utilisateur ne peut
   * pas observer une session périmée, et aucune tâche planifiée n'est à
   * déployer ni à surveiller.
   *
   * `endedAt` reçoit la date de la dernière activité, pas l'instant de la
   * fermeture : c'est le dernier moment où l'on sait que l'utilisateur
   * grimpait, et la durée affichée dans l'historique reste crédible.
   */
  private async findLiveSession(
    userId: number,
  ): Promise<{ id: number } | null> {
    const session = await this.prisma.boardSession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true, startedAt: true, entries: LAST_ENTRY },
    });
    if (!session) return null;
    if (!isStale(session)) return { id: session.id };

    await this.prisma.boardSession.update({
      where: { id: session.id },
      data: { endedAt: lastActivityOf(session) },
    });
    return null;
  }

  /**
   * Session dans laquelle consigner un log d'ascension. Trois cas, que `??`
   * confondrait :
   *
   * - `undefined` (champ absent) : rattachement implicite à la session en
   *   cours, s'il y en a une. Le client n'a pas à connaître son id pour logger.
   * - `null` explicite : hors session, même si une session est en cours.
   * - un id : la session doit exister, appartenir à l'utilisateur et être
   *   encore ouverte. Sans ce contrôle, n'importe qui pouvait écrire dans la
   *   session d'un autre, ou dans une session terminée.
   */
  async resolveSessionId(
    requested: number | null | undefined,
    userId: number,
  ): Promise<number | null> {
    if (requested === null) return null;

    if (requested === undefined) {
      const live = await this.findLiveSession(userId);
      return live?.id ?? null;
    }

    const session = await this.prisma.boardSession.findUnique({
      where: { id: requested },
      select: { id: true, userId: true, endedAt: true },
    });
    assertFound(session, 'Session');
    assertOwnerShip(session, userId);
    if (session.endedAt) {
      throw new ConflictException('Session is already ended.');
    }
    return session.id;
  }

  async startSession(dto: CreateSessionDto, user: JwtPayload) {
    // Règle métier : une seule session active par utilisateur. Une session
    // oubliée est fermée par findLiveSession et ne bloque donc plus le Start.
    const activeSession = await this.findLiveSession(user.userId);

    if (activeSession) {
      throw new ConflictException('You already have an active session.');
    }

    const title =
      dto.title ??
      `Session du ${new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })}`;

    return await this.prisma.boardSession.create({
      data: {
        userId: user.userId,
        boardId: dto.boardId ?? null,
        title,
        note: dto.note ?? null,
        startedAt: new Date(),
      },
    });
  }

  async endSession(id: number, dto: EndSessionDto, user: JwtPayload) {
    const session = await this.prisma.boardSession.findUnique({
      where: { id },
      include: { entries: LAST_ENTRY },
    });

    assertFound(session, 'Session');
    assertOwnerShip(session, user.userId);
    if (session.endedAt) {
      throw new ConflictException('Session is already ended.');
    }

    return await this.prisma.boardSession.update({
      where: { id },
      data: {
        // Un End tardif sur une session oubliée (écran resté ouvert, serveur
        // pas encore sollicité) est daté comme la fermeture automatique : à
        // la dernière activité, pas à l'instant du clic.
        endedAt: isStale(session) ? lastActivityOf(session) : new Date(),
        note: dto.note ?? session.note,
        isShared: dto.isShared ?? false,
      },
    });
  }

  async getActiveSession(userId: number) {
    const live = await this.findLiveSession(userId);
    if (!live) return null;

    return await this.prisma.boardSession.findUnique({
      where: { id: live.id },
      include: {
        board: { select: { name: true, gymName: true } },
        // `select` seul, jamais mélangé à un `include` : les deux sont
        // mutuellement exclusifs à un même niveau, et la contrainte n'est
        // vérifiée qu'à l'exécution — les args de relation imbriquée exposent
        // `select` et `include` comme deux optionnels indépendants, donc tsc
        // laisse passer le mélange. Une relation se demande donc DANS le
        // select, comme n'importe quel autre champ.
        //
        // Un passage par log : le même bloc revient autant de fois qu'il a
        // été travaillé. `status` et `attempts` sont ceux du passage ; le
        // cumul et l'historique du projet restent sur l'ascension.
        entries: {
          select: {
            id: true,
            status: true,
            attempts: true,
            createdAt: true,
            ascent: {
              select: {
                id: true,
                boulderId: true,
                wasProject: true,
                boulder: {
                  select: {
                    name: true,
                    grade: {
                      select: { vScale: true, fontScale: true, rank: true },
                    },
                    angle: { select: { valueDegrees: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getMySessions(userId: number) {
    return this.prisma.boardSession.findMany({
      where: { userId },
      include: {
        board: { select: { name: true, gymName: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }
}
