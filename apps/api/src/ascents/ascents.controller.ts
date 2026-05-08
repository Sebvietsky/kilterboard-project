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

@UseGuards(JwtAuthGuard)
@Controller('ascents')
export class AscentsController {
  constructor(private readonly ascentsService: AscentsService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateAscentDto, @CurrentUser() user: JwtPayload) {
    return this.ascentsService.create(dto, user);
  }

  @Get('me')
  async findMyAscents(@CurrentUser() user: JwtPayload) {
    return this.ascentsService.findMyAscents(user.userId);
  }

  @Get('me/:boulderId')
  async findMyAscentOnBoulder(
    @Param('boulderId', ParseIntPipe) boulderId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ascentsService.findMyAscentOnBoulder(user.userId, boulderId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAscentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ascentsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ascentsService.remove(id, user);
  }

  @Post(':id/notes')
  @HttpCode(201)
  async createNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ascentsService.createNote(id, dto, user);
  }
}
