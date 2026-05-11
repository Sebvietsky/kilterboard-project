import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import {
  AdminBoulderResult,
  AdminPlaylistResult,
  AdminUserResult,
} from './dto/admin-responst.types';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async findAllUsers(
    @Query() query: AdminQueryDto,
  ): Promise<AdminUserResult[]> {
    return this.adminService.findAllUsers(query);
  }
  @Get('boulders')
  async findAllBoulders(
    @Query() query: AdminQueryDto,
  ): Promise<AdminBoulderResult[]> {
    return this.adminService.findAllBoulders(query);
  }
  @Get('playlists')
  async findAllPlaylists(
    @Query() query: AdminQueryDto,
  ): Promise<AdminPlaylistResult[]> {
    return this.adminService.findAllPlaylists(query);
  }

  @Delete('boulders/:id')
  @HttpCode(204)
  async deleteBoulder(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.adminService.deleteBoulder(id);
  }
}
