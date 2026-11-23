import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BouldersService } from './boulders.service';
import { FilterBoulderDto } from './dto/filter-boulders.dto';
import { CreateBoulderDto } from './dto/create-boulder.dto';
import { UpdateBoulderDto } from './dto/update-boulder.dto';
import {
  BoulderCreatedDto,
  BoulderDetailDto,
  BoulderDraftDto,
  BoulderDraftSummaryDto,
  BoulderLikeStatusDto,
  BoulderSummaryDto,
  LikedBoulderDto,
  PublicNoteDto,
} from './dto/boulder-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { AngleQueryDto } from '../common/dto/angle-query.dto';

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

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(201)
  async createDraft(
    @Body() dto: CreateBoulderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderCreatedDto> {
    return this.boulderService.createDraft(user.userId, dto);
  }

  // Avant `:id` : sinon « drafts » serait lu comme un id (400 de ParseIntPipe).
  @UseGuards(JwtAuthGuard)
  @Get('drafts')
  async findMyDrafts(
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderDraftSummaryDto[]> {
    return this.boulderService.findMyDrafts(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('drafts/:id')
  async findMyDraft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderDraftDto> {
    return this.boulderService.findMyDraft(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('likes/me')
  async findMyLikes(
    @CurrentUser() user: JwtPayload,
  ): Promise<LikedBoulderDto[]> {
    return this.boulderService.findMyLikes(user.userId);
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
  @Patch(':id')
  @HttpCode(200)
  async updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBoulderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderCreatedDto> {
    return this.boulderService.updateDraft(user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async deleteDraft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.boulderService.deleteDraft(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  @HttpCode(200)
  async publishBoulder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderCreatedDto> {
    return this.boulderService.publishBoulder(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/like')
  async isLiked(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AngleQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderLikeStatusDto> {
    return this.boulderService.isLiked(user.userId, id, query.angle);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/like')
  @HttpCode(200)
  async like(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AngleQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoulderLikeStatusDto> {
    return this.boulderService.like(user.userId, id, query.angle);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  @HttpCode(204)
  async unlike(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AngleQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.boulderService.unlike(user.userId, id, query.angle);
  }
}
