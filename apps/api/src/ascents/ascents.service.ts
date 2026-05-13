import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { assertFound, assertOwnerShip } from '../common/utils/ownership.utils';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAscentDto } from './dto/update-ascent.dto';
import { JwtPayload } from '../common/interfaces/auth-payload.interface';
import {
  Ascent,
  AscentNote,
  AscentStatus,
  Boulder,
} from '../generated/prisma/client';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateAscentDto } from './dto/create-ascent.dto';
import {
  AscentWithBoulderDetails,
  AscentWithDetails,
  AscentCreated,
  AscentUpdated,
  AscentNoteCreated,
} from './dto/ascent-response.types';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { getPaginationParams } from '../common/utils/pagination.utils';
import { FilterAscentDto } from './dto/filter-ascent.dto';

@Injectable()
export class AscentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAscentDto, user: JwtPayload): Promise<AscentCreated> {
    const boulder: Boulder | null = await this.prisma.boulder.findUnique({
      where: { id: dto.boulderId },
    });
    assertFound(boulder, 'Boulder');
    if (!boulder.isPublic || boulder.isDraft)
      throw new NotFoundException('Boulder not found');

    // Règle métier : si déjà en project, bloquer flash/sent depuis Discover
    const existingProject: Ascent | null = await this.prisma.ascent.findFirst({
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
    const wasProject: boolean = !!existingProject;

    return await this.prisma.ascent.create({
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

  async findMyAscents(
    userId: number,
    filters: FilterAscentDto,
  ): Promise<PaginatedResponse<AscentWithDetails>> {
    const { skip, take, page, limit } = getPaginationParams(
      filters.page,
      filters.limit,
    );

    const [ascents, total] = await Promise.all([
      this.prisma.ascent.findMany({
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
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ascent.count({ where: { userId } }),
    ]);

    return {
      data: ascents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMyAscentOnBoulder(
    userId: number,
    boulderId: number,
  ): Promise<AscentWithBoulderDetails[]> {
    return await this.prisma.ascent.findMany({
      where: { userId, boulderId },
      include: {
        feltGrade: { select: { vScale: true, fontScale: true } },
        ascentNotes: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: number,
    dto: UpdateAscentDto,
    user: JwtPayload,
  ): Promise<AscentUpdated> {
    const ascent: Ascent | null = await this.prisma.ascent.findUnique({
      where: { id },
    });
    assertFound(ascent, 'Ascent');
    assertOwnerShip(ascent, user.userId);

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

    return await this.prisma.ascent.update({
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

  async remove(id: number, user: JwtPayload): Promise<void> {
    const ascent = await this.prisma.ascent.findUnique({ where: { id } });
    assertFound(ascent, 'Ascent');
    assertOwnerShip(ascent, user.userId);
    if (ascent.status !== AscentStatus.PROJECT) {
      throw new BadRequestException('Only PROJECT ascents can be deleted.');
    }

    await this.prisma.ascent.delete({ where: { id } });
  }

  async createNote(
    id: number,
    dto: CreateNoteDto,
    user: JwtPayload,
  ): Promise<AscentNoteCreated> {
    const ascent: Ascent | null = await this.prisma.ascent.findUnique({
      where: { id },
    });
    assertFound(ascent, 'Ascent');
    assertOwnerShip(ascent, user.userId);

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
      const existingPublicNote: AscentNote | null =
        await this.prisma.ascentNote.findFirst({
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

    return await this.prisma.ascentNote.create({
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
