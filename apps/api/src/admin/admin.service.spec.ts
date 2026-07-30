import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/client';

const prismaMock = {
  user: { findMany: jest.fn() },
  boulder: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  playlist: { findMany: jest.fn() },
};

// Les trois listes admin partagent la même mécanique (filtres, pagination,
// tri sécurisé). On lit l'argument passé à Prisma pour la vérifier.
function queryArg(mock: jest.Mock): {
  where: Record<string, unknown>;
  orderBy: Record<string, string>;
  skip: number;
  take: number;
} {
  const [arg] = mock.mock.calls[0] as [
    {
      where: Record<string, unknown>;
      orderBy: Record<string, string>;
      skip: number;
      take: number;
    },
  ];
  return arg;
}

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AdminService);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.boulder.findMany.mockResolvedValue([]);
    prismaMock.playlist.findMany.mockResolvedValue([]);
  });

  describe('findAllUsers', () => {
    it('nappplique aucun filtre quand la requête est vide', async () => {
      await service.findAllUsers({});

      expect(queryArg(prismaMock.user.findMany).where).toEqual({});
    });

    it('filtre par rôle et par recherche insensible à la casse', async () => {
      await service.findAllUsers({ role: Role.ADMIN, search: 'SEB' });

      expect(queryArg(prismaMock.user.findMany).where).toEqual({
        role: Role.ADMIN,
        username: { contains: 'SEB', mode: 'insensitive' },
      });
    });

    // Le champ de tri vient de la query string et finit dans un orderBy Prisma.
    // L'allowlist est la seule chose qui l'empêche d'atteindre une colonne
    // arbitraire — d'où un test par service qui l'utilise.
    it('replie un champ de tri non autorisé sur createdAt', async () => {
      await service.findAllUsers({ orderBy: 'passwordHash' });

      expect(queryArg(prismaMock.user.findMany).orderBy).toEqual({
        createdAt: 'desc',
      });
    });

    it('accepte un champ de tri autorisé', async () => {
      await service.findAllUsers({ orderBy: 'username', order: 'asc' });

      expect(queryArg(prismaMock.user.findMany).orderBy).toEqual({
        username: 'asc',
      });
    });

    it('pagine avec les valeurs par défaut', async () => {
      await service.findAllUsers({});

      expect(queryArg(prismaMock.user.findMany)).toMatchObject({
        skip: 0,
        take: 20,
      });
    });
  });

  describe('findAllBoulders', () => {
    // isPublic est un booléen : le tester avec `&&` ferait disparaître le
    // filtre quand on cherche justement les blocs privés.
    it.each([true, false])('filtre sur isPublic: %s', async (isPublic) => {
      await service.findAllBoulders({ isPublic });

      expect(queryArg(prismaMock.boulder.findMany).where).toEqual({ isPublic });
    });

    it('replie un champ de tri non autorisé', async () => {
      await service.findAllBoulders({ orderBy: 'creatorId' });

      expect(queryArg(prismaMock.boulder.findMany).orderBy).toEqual({
        createdAt: 'desc',
      });
    });
  });

  describe('findAllPlaylists', () => {
    it('replie un champ de tri non autorisé', async () => {
      await service.findAllPlaylists({ orderBy: 'userId' });

      expect(queryArg(prismaMock.playlist.findMany).orderBy).toEqual({
        createdAt: 'desc',
      });
    });

    it('accepte un champ de tri autorisé', async () => {
      await service.findAllPlaylists({ orderBy: 'name' });

      expect(queryArg(prismaMock.playlist.findMany).orderBy).toEqual({
        name: 'desc',
      });
    });
  });

  describe('deleteBoulder', () => {
    it('supprime un bloc existant', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });

      await service.deleteBoulder(10);

      expect(prismaMock.boulder.delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });
    });

    // Un delete Prisma sur un id absent lève une erreur technique (P2025) ;
    // on vérifie d'abord pour répondre un 404 propre.
    it('rejette un bloc inexistant sans tenter la suppression', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(service.deleteBoulder(404)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.boulder.delete).not.toHaveBeenCalled();
    });
  });
});
