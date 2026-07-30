import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { TokenService } from './token.service';
import { AuthTokens } from '../common/interfaces/auth-tokens.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Throttle } from '@nestjs/throttler';
import { User } from '../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private tokenService: TokenService,
  ) {}

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    dto: RegisterDto,
  ): Promise<{ success: true; message: string }> {
    const existingUser: User | null = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'Registration failed. Please check your credentials.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
      },
    });

    return { success: true, message: 'Account created successfully' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(dto: LoginDto): Promise<AuthTokens> {
    const identifier: boolean = dto.identifier.includes('@');

    const user: User | null = await this.prisma.user.findFirst({
      where: {
        ...(identifier
          ? { email: dto.identifier }
          : { username: dto.identifier }),
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Login failed. Please check your credentials',
      );
    }

    // verifier avec bcrypt
    const isMatchingPassword = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isMatchingPassword) {
      throw new UnauthorizedException(
        'Login failed. Please check your credentials',
      );
    }

    // si ok générer 2 token : access token (short period of time) +  refresh token (longer) en bdd
    const { accessToken, refreshToken } =
      await this.tokenService.generateTokens(user);

    return { accessToken, refreshToken };
  }

  async logoutUser(userId: number): Promise<void> {
    await this.tokenService.deleteRefreshToken(userId);
  }

  async getAuthenticateUser(userId: number): Promise<UserResponseDto> {
    const user: Omit<User, 'passwordHash' | 'xpPoints' | 'level'> | null =
      await this.prisma.user.findUnique({
        where: { id: userId },
        omit: { passwordHash: true, xpPoints: true, level: true },
      });

    if (!user)
      throw new UnauthorizedException("Token payload doesn't match any user");

    return user;
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    const token = refreshTokenDto.refreshToken;

    if (!token) throw new UnauthorizedException('Refresh token not provided');

    // On charge l'utilisateur directement depuis la DB en incluant le user associé,
    // évitant une seconde requête pour récupérer ses informations
    const existingToken = await this.prisma.refreshToken.findFirst({
      where: { token },
      include: { user: true },
    });
    if (!existingToken)
      throw new UnauthorizedException('Invalid Refresh token');

    // Vérification de l'expiration côté serveur (double sécurité avec la date en DB)
    if (existingToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: existingToken.id },
      });
      throw new UnauthorizedException('Invalid Refresh token');
    }

    const { accessToken, refreshToken } =
      await this.tokenService.generateTokens(existingToken.user);

    return { accessToken, refreshToken };
  }
}
