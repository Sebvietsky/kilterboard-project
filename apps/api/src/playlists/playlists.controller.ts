import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  UseGuards,
  Param,
  Patch,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlaylistsService } from './playlists.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';
import {
  PlaylistDetailDto,
  PlaylistResponseDto,
  PlaylistSummaryDto,
} from './dto/playlist-response.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import {
  AddBoulderDto,
  AddOrRemoveBoulderResponseDto,
} from './dto/add-boulder.dto';

@UseGuards(JwtAuthGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

  @Post()
  async createPlaylist(
    @Body() dto: CreatePlaylistDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PlaylistResponseDto> {
    return this.playlistService.createPlaylist(dto, user.userId);
  }

  @Get('me')
  async findMine(
    @CurrentUser() user: JwtPayload,
  ): Promise<PlaylistSummaryDto[]> {
    return this.playlistService.findMine(user);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PlaylistDetailDto> {
    return this.playlistService.findOne(id);
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: UpdatePlaylistDto,
  ): Promise<PlaylistResponseDto> {
    return this.playlistService.update(dto, user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.playlistService.removePlaylist(user, id);
  }

  @Post(':id/boulders')
  @HttpCode(201)
  async addBoulderIntoPlaylist(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: AddBoulderDto,
  ): Promise<AddOrRemoveBoulderResponseDto> {
    return this.playlistService.addBoulder(user, dto, id);
  }

  @Delete(':id/boulders/:boulderId')
  @HttpCode(204)
  async deleteBoulderFromPlaylist(
    @Param('id', ParseIntPipe) playlistId: number,
    @CurrentUser() user: JwtPayload,
    @Param('boulderId', ParseIntPipe) boulderId: number,
  ): Promise<void> {
    return this.playlistService.removeBoulder(user, boulderId, playlistId);
  }
}
