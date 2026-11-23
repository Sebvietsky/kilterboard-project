import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BoardSizeDto,
  BoardSizeSummaryDto,
} from './dto/board-size-response.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllSizes(): Promise<BoardSizeSummaryDto[]> {
    return this.prisma.boardSize.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
  }

  async findSize(id: number): Promise<BoardSizeDto> {
    const size = await this.prisma.boardSize.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        edgeLeft: true,
        edgeRight: true,
        edgeBottom: true,
        edgeTop: true,
        leds: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            hold: { select: { id: true, holdCode: true, x: true, y: true } },
          },
        },
      },
    });
    if (!size) {
      throw new NotFoundException('Board size not found');
    }

    const { leds, ...frame } = size;
    return {
      ...frame,
      holds: leds.map(({ position, hold }) => ({
        ...hold,
        ledPosition: position,
      })),
    };
  }
}
