import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAscentDto } from './dto/update-ascent.dto';
import { JwtPayload } from '../common/interfaces/auth-payload.interface';
import { AscentStatus } from '../generated/prisma/client';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateAscentDto } from './dto/create-ascent.dto';

@Injectable()
export class AscentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAscentDto, user: JwtPayload) {
    const boulder = await this.prisma.boulder.findUnique({
      where: { id: dto.boulderId },
    });
    if (!boulder) throw new NotFoundException('Boulder not found');
    if (!boulder.isPublic || boulder.isDraft)
      throw new NotFoundException('Boulder not found');

    // Règle métier : si déjà en project, bloquer flash/sent depuis Discover
    const existingProject = await this.prisma.ascent.findFirst({
      where: {
        userId: user.userId,
        boulderId: dto.boulderId,
        status: AscentStatus.PROJECT,
      },
    });

    if (
      existingProject &&
      (dto.status === AscentStatus.FLASH || dto.status === AscentStatus.SENT)
    ) {
      throw new BadRequestException(
        'You have an active project on this boulder. Finish it from your Projects tab.',
      );
    }

    // Règle métier : feltGradeId obligatoire pour SENT et FLASH
    if (
      (dto.status === AscentStatus.SENT || dto.status === AscentStatus.FLASH) &&
      !dto.feltGradeId
    ) {
      throw new BadRequestException(
        'Felt grade is required for SENT and FLASH ascents.',
      );
    }

    // Calcul wasProject
    const wasProject = !!existingProject;

    return this.prisma.ascent.create({
      data: {
        userId: user.userId,
        boulderId: dto.boulderId,
        status: dto.status,
        attemptsCount: dto.attemptsCount ?? 0,
        feltGradeId: dto.feltGradeId ?? null,
        rating: dto.rating ?? null,
        sessionId: dto.sessionId ?? null,
        sendDate: dto.status !== AscentStatus.PROJECT ? new Date() : null,
        wasProject,
      },
    });
  }

  async findMyAscents(userId: number) {
    return this.prisma.ascent.findMany({
      where: { userId },
      include: {
        boulder: {
          select: {
            name: true,
            grade: { select: { vScale: true, fontScale: true, rank: true } },
            angle: { select: { valueDegrees: true } },
          },
        },
        feltGrade: { select: { vScale: true, fontScale: true } },
        ascentNotes: {
          where: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyAscentOnBoulder(userId: number, boulderId: number) {
    return this.prisma.ascent.findMany({
      where: { userId, boulderId },
      include: {
        feltGrade: { select: { vScale: true, fontScale: true } },
        ascentNotes: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: number, dto: UpdateAscentDto, user: JwtPayload) {
    const ascent = await this.prisma.ascent.findUnique({ where: { id } });
    if (!ascent) throw new NotFoundException('Ascent not found');
    if (ascent.userId !== user.userId) throw new ForbiddenException();

    // Règle métier : feltGradeId obligatoire si on passe à SENT ou FLASH
    if (
      (dto.status === AscentStatus.SENT || dto.status === AscentStatus.FLASH) &&
      !dto.feltGradeId &&
      !ascent.feltGradeId
    ) {
      throw new BadRequestException(
        'Felt grade is required to finish a project.',
      );
    }

    const wasProject =
      ascent.status === AscentStatus.PROJECT &&
      (dto.status === AscentStatus.SENT || dto.status === AscentStatus.FLASH);

    return this.prisma.ascent.update({
      where: { id },
      data: {
        ...dto,
        wasProject: wasProject || ascent.wasProject,
        sendDate:
          dto.status && dto.status !== AscentStatus.PROJECT
            ? new Date()
            : ascent.sendDate,
      },
    });
  }

  async remove(id: number, user: JwtPayload) {
    const ascent = await this.prisma.ascent.findUnique({ where: { id } });
    if (!ascent) throw new NotFoundException('Ascent not found');
    if (ascent.userId !== user.userId) throw new ForbiddenException();
    if (ascent.status !== AscentStatus.PROJECT) {
      throw new BadRequestException('Only PROJECT ascents can be deleted.');
    }

    return this.prisma.ascent.delete({ where: { id } });
  }

  async createNote(id: number, dto: CreateNoteDto, user: JwtPayload) {
    const ascent = await this.prisma.ascent.findUnique({ where: { id } });
    if (!ascent) throw new NotFoundException('Ascent not found');
    if (ascent.userId !== user.userId) throw new ForbiddenException();

    // Règle métier : 1 seule note publique par user par bloc (premier SENT ou FLASH uniquement)
    // Les REPEAT ne peuvent avoir que des notes privées
    if (
      dto.visibility === 'PUBLIC' &&
      ascent.status !== AscentStatus.SENT &&
      ascent.status !== AscentStatus.FLASH
    ) {
      throw new BadRequestException(
        'Public notes are only allowed on your first SENT or FLASH ascent.',
      );
    }

    // Règle métier : 1 seule note publique par user par bloc
    if (dto.visibility === 'PUBLIC') {
      const existingPublicNote = await this.prisma.ascentNote.findFirst({
        where: {
          userId: user.userId,
          boulderId: ascent.boulderId,
          visibility: 'PUBLIC',
        },
      });
      if (existingPublicNote) {
        throw new BadRequestException(
          'You already have a public note on this boulder.',
        );
      }
    }

    return this.prisma.ascentNote.create({
      data: {
        ascentId: id,
        userId: user.userId,
        boulderId: ascent.boulderId,
        content: dto.content,
        visibility: dto.visibility,
      },
    });
  }
}
