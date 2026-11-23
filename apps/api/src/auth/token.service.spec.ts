import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { REFRESH_REUSE_GRACE_MS, TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '../generated/prisma/client';

// Prisma est mocké : chaque opération renvoie une étiquette, et `$transaction`
// reçoit la liste de ces étiquettes. On vérifie donc QUELLES écritures sont
// demandées et avec quels arguments, pas leur effet en base.
const prismaMock = {
  refreshToken: {
    deleteMany: jest.fn().mockReturnValue('deleteMany'),
    update: jest.fn().mockReturnValue('update'),
    create: jest.fn().mockReturnValue('create'),
  },
  $transaction: jest.fn().mockResolvedValue([]),
};

const jwtMock = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };

const user = { id: 1, role: Role.USER, username: 'seb' } as User;

function firstArg<T>(mock: jest.Mock): T {
  const [arg] = mock.mock.calls[0] as [T];
  return arg;
}

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  describe('generateTokens — connexion', () => {
    // Régression : chaque connexion supprimait tous les tokens du compte. Se
    // connecter sur un second appareil déconnectait le premier.
    it('ne supprime que les tokens expirés, pas ceux des autres appareils', async () => {
      await service.generateTokens(user);

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
      expect(
        firstArg<{ where: unknown }>(prismaMock.refreshToken.deleteMany).where,
      ).toEqual({
        userId: user.id,
        expiresAt: { lt: expect.any(Date) as Date },
      });
    });

    it("n'écourte aucun token quand il n'y a pas de token remplacé", async () => {
      await service.generateTokens(user);

      expect(prismaMock.refreshToken.update).not.toHaveBeenCalled();
      expect(firstArg<unknown[]>(prismaMock.$transaction)).toEqual([
        'deleteMany',
        'create',
      ]);
    });

    it('renvoie le refresh token qu’il vient de stocker', async () => {
      const tokens = await service.generateTokens(user);

      const stored = firstArg<{ data: { token: string; userId: number } }>(
        prismaMock.refreshToken.create,
      ).data;
      expect(tokens.refreshToken.token).toBe(stored.token);
      expect(stored.userId).toBe(user.id);
    });
  });

  describe('generateTokens — refresh', () => {
    const inOneDay = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Le token présenté n'est pas supprimé : si la réponse se perd, le client
    // n'a que lui à rejouer.
    it('laisse le token remplacé valide le temps du délai de grâce', async () => {
      const before = Date.now();

      await service.generateTokens(user, { id: 5, expiresAt: inOneDay() });

      const update = firstArg<{
        where: { id: number };
        data: { expiresAt: Date };
      }>(prismaMock.refreshToken.update);
      expect(update.where).toEqual({ id: 5 });
      const graceEnd = update.data.expiresAt.getTime();
      expect(graceEnd).toBeGreaterThanOrEqual(before + REFRESH_REUSE_GRACE_MS);
      expect(graceEnd).toBeLessThanOrEqual(Date.now() + REFRESH_REUSE_GRACE_MS);
    });

    // Sans ce plafond, rejouer le token pendant la grâce repousserait son
    // échéance à chaque fois : il ne mourrait jamais.
    it("ne rallonge pas un token dont l'échéance est déjà plus proche", async () => {
      const soon = new Date(Date.now() + 10_000);

      await service.generateTokens(user, { id: 5, expiresAt: soon });

      expect(
        firstArg<{ data: { expiresAt: Date } }>(prismaMock.refreshToken.update)
          .data.expiresAt,
      ).toBe(soon);
    });
  });

  describe('deleteRefreshToken', () => {
    it("ne révoque que le token fourni, et seulement s'il est à l'utilisateur", async () => {
      await service.deleteRefreshToken(1, 'refresh');

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1, token: 'refresh' },
      });
    });
  });
});
