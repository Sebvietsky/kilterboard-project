import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokens } from '../common/interfaces/auth-tokens.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type JwtPayload } from '../common/interfaces/auth-payload.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ success: true; message: string }> {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logoutUser(user.userId);
  }

  @SkipThrottle()
  @Post('refresh')
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthTokens> {
    return this.authService.refreshToken(refreshTokenDto);
  }
}
