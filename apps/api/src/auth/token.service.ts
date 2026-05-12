import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthTokens } from '../common/interfaces/auth-tokens.interface';
import { type User } from '../generated/prisma/client';
import { randomBytes } from 'node:crypto';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async generateTokens(user: User): Promise<AuthTokens> {
    const refreshTokenValue = randomBytes(64).toString('hex');
    const expiresInMs = 7 * 24 * 60 * 60 * 1000;

    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + expiresInMs),
        },
      }),
    ]);

    const payload = {
      userId: user.id,
      role: user.role,
      username: user.username,
    };

    const accessToken = {
      token: await this.jwtService.signAsync(payload),
      type: 'Bearer' as const,
      expiresInMs: 15 * 60 * 1000,
    };

    const refreshToken = {
      token: refreshTokenValue,
      type: 'Bearer' as const,
      expiresInMs,
    };

    return { accessToken, refreshToken };
  }

  async deleteRefreshToken(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId: userId },
    });
  }
}
