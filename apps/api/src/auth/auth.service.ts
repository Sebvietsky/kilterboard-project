import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ success: true; message: string }> {
    const existingUser = await this.prisma.user.findFirst({
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
  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const identifier: boolean = dto.identifier.includes('@');

    const user = await this.prisma.user.findFirst({
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
    const payload = {
      userId: user.id,
      role: user.role,
      username: user.username,
    };

    const accessToken = {
      token: await this.jwtService.signAsync(payload),
      type: 'Bearer',
      expiresInMs: 15 * 60 * 1000,
    };
    const refreshToken = {
      token: randomBytes(64).toString('hex'),
      type: 'Bearer',
      expiresInMs: 7 * 24 * 60 * 60 * 1000,
    };

    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
      },
    });
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken.token,
        userId: user.id,
        issuedAt: new Date(),
        expiresAt: new Date(new Date().valueOf() + refreshToken.expiresInMs),
      },
    });

    return { accessToken, refreshToken };
  }
}
