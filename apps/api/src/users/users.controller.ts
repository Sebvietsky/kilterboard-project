import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { MyBoulderDto } from './dto/my-boulder.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.userId);
  }

  @Patch('me')
  async updateMe(@Body() dto: UpdateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.updateMe(user.userId, dto);
  }

  @Get('me/projects')
  async getMyProjects(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProjects(user.userId);
  }

  // Seulement les miens : la liste ne s'affiche que sur son propre profil
  // (Seb, 2026-11-23). Avant `:username`, qui lirait « me » comme un pseudo.
  @Get('me/boulders')
  async getMyBoulders(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedResponse<MyBoulderDto>> {
    return this.usersService.getMyBoulders(user.userId, query);
  }

  @Get(':username')
  async getPublicProfile(
    @Param('username') username: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.getPublicProfile(username, user.userId);
  }

  @Post(':username/follow')
  @HttpCode(201)
  async follow(
    @Param('username') username: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.follow(user.userId, username);
  }

  @Delete(':username/follow')
  @HttpCode(204)
  async unfollow(
    @Param('username') username: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.unfollow(user.userId, username);
  }
}
