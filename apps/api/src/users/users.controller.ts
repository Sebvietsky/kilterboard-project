import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
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

  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
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
