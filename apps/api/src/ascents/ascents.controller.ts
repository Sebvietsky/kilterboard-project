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
  UseGuards,
} from '@nestjs/common';
import { AscentsService } from './ascents.service';
import { CreateAscentDto } from './dto/create-ascent.dto';
import { UpdateAscentDto } from './dto/update-ascent.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';
import {
  AscentCreated,
  AscentNoteCreated,
  AscentUpdated,
  AscentWithBoulderDetails,
  AscentWithDetails,
} from './dto/ascent-response.types';

@UseGuards(JwtAuthGuard)
@Controller('ascents')
export class AscentsController {
  constructor(private readonly ascentsService: AscentsService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateAscentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AscentCreated> {
    return this.ascentsService.create(dto, user);
  }

  @Get('me')
  async findMyAscents(
    @CurrentUser() user: JwtPayload,
  ): Promise<AscentWithDetails[]> {
    return this.ascentsService.findMyAscents(user.userId);
  }

  @Get('me/:boulderId')
  async findMyAscentOnBoulder(
    @Param('boulderId', ParseIntPipe) boulderId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<AscentWithBoulderDetails[]> {
    return this.ascentsService.findMyAscentOnBoulder(user.userId, boulderId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAscentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AscentUpdated> {
    return this.ascentsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.ascentsService.remove(id, user);
  }

  @Post(':id/notes')
  @HttpCode(201)
  async createNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AscentNoteCreated> {
    return this.ascentsService.createNote(id, dto, user);
  }
}
