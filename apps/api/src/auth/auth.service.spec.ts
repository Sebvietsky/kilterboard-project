import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/client';

// bcrypt est mocké : son coût est volontairement élevé (10 rounds), et ce
// qu'on teste ici est la logique d'authentification, pas l'algorithme de hash.
jest.mock('bcrypt');
// `hash` et `compare` sont surchargées (promesse ou callback). Les typer en
// jest.Mock évite que TypeScript choisisse la surcharge à callback, dont le
// retour void déclenche `no-misused-promises` sur nos implémentations async.
const bcryptMock = jest.mocked(bcrypt) as unknown as {
  hash: jest.Mock;
  compare: jest.Mock;
};

const prismaMock = {
  user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  refreshToken: { findFirst: jest.fn(), delete: jest.fn() },
};

const tokenServiceMock = {
  generateTokens: jest.fn(),
  deleteRefreshToken: jest.fn(),
};

const existingUser = {
  id: 1,
  username: 'seb',
  email: 'seb@example.com',
  passwordHash: 'hash',
  role: Role.USER,
};

const issuedTokens = {
  accessToken: {
    token: 'access',
    type: 'Bearer' as const,
    expiresInMs: 900000,
  },
  refreshToken: { token: 'refresh', type: 'Bearer' as const, expiresInMs: 1 },
};

const inOneHour = () => new Date(Date.now() + 3_600_000);
const oneHourAgo = () => new Date(Date.now() - 3_600_000);

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokenService, useValue: tokenServiceMock },
      ],
    }).compile();

    service = module.get(AuthService);
    tokenServiceMock.generateTokens.mockResolvedValue(issuedTokens);
  });

  describe('register', () => {
    it('hache le mot de passe avant de créer le compte', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('hashed');

      await service.register({
        username: 'seb',
        email: 'seb@example.com',
        password: 'plaintext',
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          username: 'seb',
          email: 'seb@example.com',
          passwordHash: 'hashed',
        },
      });
    });

    // Le message ne dit pas lequel des deux est pris : distinguer permettrait
    // d'énumérer les comptes existants.
    it('rejette un email ou un username déjà pris, sans dire lequel', async () => {
      prismaMock.user.findFirst.mockResolvedValue(existingUser);

      await expect(
        service.register({
          username: 'seb',
          email: 'seb@example.com',
          password: 'plaintext',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    beforeEach(() => {
      prismaMock.user.findFirst.mockResolvedValue(existingUser);
      bcryptMock.compare.mockResolvedValue(true);
    });

    // Le champ accepte l'un ou l'autre : la présence d'un @ décide de la colonne.
    it("cherche par email quand l'identifiant contient un @", async () => {
      await service.login({ identifier: 'seb@example.com', password: 'pw' });

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'seb@example.com' },
      });
    });

    it('cherche par username sinon', async () => {
      await service.login({ identifier: 'seb', password: 'pw' });

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'seb' },
      });
    });

    it('émet une paire de tokens quand le mot de passe correspond', async () => {
      await expect(
        service.login({ identifier: 'seb', password: 'pw' }),
      ).resolves.toEqual(issuedTokens);
    });

    // Utilisateur inconnu et mot de passe faux renvoient la même erreur : les
    // distinguer révélerait quels comptes existent.
    it('rejette un utilisateur inconnu', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'ghost', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejette un mot de passe incorrect', async () => {
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'seb', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(tokenServiceMock.generateTokens).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const storedToken = {
      id: 5,
      token: 'refresh',
      userId: existingUser.id,
      expiresAt: inOneHour(),
      user: existingUser,
    };

    it('émet une nouvelle paire à partir du token stocké', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(storedToken);

      await expect(
        service.refreshToken({ refreshToken: 'refresh' }),
      ).resolves.toEqual(issuedTokens);
      expect(tokenServiceMock.generateTokens).toHaveBeenCalledWith(
        existingUser,
      );
    });

    // Régression : le service supprimait TOUS les refresh tokens du user après
    // les avoir régénérés, effaçant du même coup celui qu'il venait d'émettre.
    // Le client repartait avec un token absent de la base, et se retrouvait
    // déconnecté au refresh suivant — 15 min après le login.
    // La rotation est la responsabilité de generateTokens, et d'elle seule.
    it("ne supprime pas le token qu'il vient d'émettre", async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(storedToken);

      await service.refreshToken({ refreshToken: 'refresh' });

      expect(tokenServiceMock.deleteRefreshToken).not.toHaveBeenCalled();
    });

    it('rejette un token absent de la base', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'unknown' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Expiration vérifiée côté serveur en plus de la date en base : on ne fait
    // pas confiance à ce que le client renvoie.
    it('supprime un token expiré et refuse la demande', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...storedToken,
        expiresAt: oneHourAgo(),
      });

      await expect(
        service.refreshToken({ refreshToken: 'refresh' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: storedToken.id },
      });
      expect(tokenServiceMock.generateTokens).not.toHaveBeenCalled();
    });
  });

  describe('getAuthenticateUser', () => {
    // Le token est valide mais le compte a disparu (suppression, base restaurée).
    it('rejette un payload qui ne correspond à aucun utilisateur', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getAuthenticateUser(1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('ne renvoie jamais le hash du mot de passe', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'seb',
        email: 'seb@example.com',
      });

      await service.getAuthenticateUser(1);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: { passwordHash: true, xpPoints: true, level: true },
      });
    });
  });

  describe('logoutUser', () => {
    it('supprime le refresh token stocké', async () => {
      await service.logoutUser(1);

      expect(tokenServiceMock.deleteRefreshToken).toHaveBeenCalledWith(1);
    });
  });
});
