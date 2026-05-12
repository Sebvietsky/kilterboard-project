import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BouldersService } from './boulders.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import {
  BoulderDetailDto,
  BoulderSummaryDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';

@Controller('boulders')
export class BouldersController {
  constructor(private readonly boulderService: BouldersService) {}
  @Get()
  @HttpCode(200)
  async findAll(
    @Query() filters: FilterBoulderDto,
  ): Promise<PaginatedResponse<BoulderSummaryDto>> {
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

  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  @HttpCode(200)
  async publishBoulder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.boulderService.publishBoulder(id, user.userId);
  }
}
