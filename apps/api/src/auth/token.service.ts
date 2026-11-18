import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthTokens } from '../common/interfaces/auth-tokens.interface';
import { type User } from '../generated/prisma/client';
import { randomBytes } from 'node:crypto';

// Durée pendant laquelle un refresh token déjà utilisé reste accepté.
export const REFRESH_REUSE_GRACE_MS = 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Émet une paire de tokens pour l'utilisateur.
   *
   * Un refresh token par APPAREIL, pas par compte : les autres tokens de
   * l'utilisateur ne sont pas touchés. Les supprimer tous, comme avant,
   * déconnectait le téléphone dès qu'on se connectait ailleurs avec le même
   * compte (un second appareil, Bruno, un script).
   *
   * `replaced` est le token présenté lors d'un refresh. Il n'est pas supprimé
   * sur-le-champ mais laissé valide `REFRESH_REUSE_GRACE_MS` : si la réponse
   * se perd (app rechargée, réseau coupé), le client n'a jamais reçu le
   * nouveau token et rejouera l'ancien. Le supprimer tout de suite le
   * déconnecterait alors sans qu'il ait rien fait de mal.
   */
  async generateTokens(
    user: User,
    replaced?: { id: number; expiresAt: Date },
  ): Promise<AuthTokens> {
    const refreshTokenValue = randomBytes(64).toString('hex');
    const expiresInMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const graceEnd = new Date(now + REFRESH_REUSE_GRACE_MS);

    await this.prisma.$transaction([
      // Ménage : seuls les tokens déjà expirés de cet utilisateur partent.
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date(now) } },
      }),
      ...(replaced
        ? [
            this.prisma.refreshToken.update({
              where: { id: replaced.id },
              // min() : le délai de grâce ne doit jamais RALLONGER un token.
              // Rejoué pendant la grâce, il garde sa première échéance.
              data: {
                expiresAt:
                  replaced.expiresAt < graceEnd ? replaced.expiresAt : graceEnd,
              },
            }),
          ]
        : []),
      this.prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          issuedAt: new Date(now),
          expiresAt: new Date(now + expiresInMs),
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

  /**
   * Déconnexion d'un appareil : seul le token fourni est révoqué.
   *
   * `userId` reste dans le filtre : on ne peut révoquer que ses propres
   * tokens, même en présentant celui d'un autre.
   */
  async deleteRefreshToken(userId: number, token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token },
    });
  }
}
