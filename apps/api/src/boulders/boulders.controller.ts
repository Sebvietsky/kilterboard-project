import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { BouldersService } from './boulders.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import {
  BoulderDetailDto,
  BoulderSummaryDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';

@Controller('boulders')
export class BouldersController {
  constructor(private readonly boulderService: BouldersService) {}
  @Get()
  @HttpCode(200)
  async findAll(
    @Query() filters: FilterBoulderDto,
  ): Promise<BoulderSummaryDto[]> {
    return this.boulderService.findAll(filters);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BoulderDetailDto> {
    return this.boulderService.findOne(id);
  }

  @Get(':id/comments')
  async findBoulderComments(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicNoteDto[]> {
    return this.boulderService.findComments(id);
  }
}
