import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BoardsService } from './boards.service';
import {
  BoardSizeDto,
  BoardSizeSummaryDto,
} from './dto/board-size-response.dto';

// Matériel de référence, public comme le catalogue des blocs.
@Controller('board-sizes')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  async findAllSizes(): Promise<BoardSizeSummaryDto[]> {
    return this.boardsService.findAllSizes();
  }

  @Get(':id')
  async findSize(@Param('id', ParseIntPipe) id: number): Promise<BoardSizeDto> {
    return this.boardsService.findSize(id);
  }
}
