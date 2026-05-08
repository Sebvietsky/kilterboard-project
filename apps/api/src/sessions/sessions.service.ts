import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { JwtPayload } from '../common/interfaces/auth-payload.interface';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async startSession(dto: CreateSessionDto, user: JwtPayload) {
    // Règle métier : une seule session active par utilisateur
    const activeSession = await this.prisma.boardSession.findFirst({
      where: { userId: user.userId, endedAt: null },
    });

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

    return this.prisma.boardSession.create({
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
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== user.userId) throw new ForbiddenException();
    if (session.endedAt) {
      throw new ConflictException('Session is already ended.');
    }

    return this.prisma.boardSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        note: dto.note ?? session.note,
        isShared: dto.isShared ?? false,
      },
    });
  }

  async getActiveSession(userId: number) {
    return this.prisma.boardSession.findFirst({
      where: { userId, endedAt: null },
      include: {
        board: { select: { name: true, gymName: true } },
        ascents: {
          include: {
            boulder: { select: { name: true } },
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
        _count: { select: { ascents: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }
}
