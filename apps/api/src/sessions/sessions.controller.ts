import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(201)
  async startSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionsService.startSession(dto, user);
  }

  @Patch(':id/end')
  async endSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EndSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sessionsService.endSession(id, dto, user);
  }

  @Get('active')
  async getActiveSession(@CurrentUser() user: JwtPayload) {
    return this.sessionsService.getActiveSession(user.userId);
  }

  @Get('me')
  async getMySessions(@CurrentUser() user: JwtPayload) {
    return this.sessionsService.getMySessions(user.userId);
  }
}
