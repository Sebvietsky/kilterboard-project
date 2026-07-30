import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/client';

const prismaMock = {
  playlist: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  boulder: { findUnique: jest.fn() },
  playlistBoulder: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const user = { userId: 1, role: Role.USER, username: 'seb' };
const stranger = { userId: 999, role: Role.USER, username: 'other' };

// La forme complète attendue par findOne, qui déréférence les relations.
const ownedPlaylist = {
  id: 3,
  userId: user.userId,
  name: 'Warmups',
  description: null,
  isPublic: false,
  createdAt: new Date(),
  user: { username: 'seb' },
  _count: { playlistBoulders: 0 },
  playlistBoulders: [],
};

describe('PlaylistsService', () => {
  let service: PlaylistsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(PlaylistsService);
  });

  describe('findOne', () => {
    it('rejette une playlist inexistante', async () => {
      prismaMock.playlist.findUnique.mockResolvedValue(null);

      await expect(service.findOne(3, user)).rejects.toThrow(NotFoundException);
    });

    it('laisse le propriétaire voir sa playlist privée', async () => {
      prismaMock.playlist.findUnique.mockResolvedValue(ownedPlaylist);

      await expect(service.findOne(3, user)).resolves.toMatchObject({ id: 3 });
    });

    // La visibilité tient à deux conditions liées par un OU : publique, OU à
    // moi. Casser l'une des deux ouvrirait les playlists privées de tout le
    // monde sans qu'aucun autre test ne bronche.
    it("refuse une playlist privée à quelqu'un d'autre", async () => {
      prismaMock.playlist.findUnique.mockResolvedValue(ownedPlaylist);

      await expect(service.findOne(3, stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('laisse un tiers voir une playlist publique', async () => {
      prismaMock.playlist.findUnique.mockResolvedValue({
        ...ownedPlaylist,
        isPublic: true,
      });

      await expect(service.findOne(3, stranger)).resolves.toMatchObject({
        id: 3,
      });
    });
  });

  describe('createPlaylist', () => {
    // Une playlist naît privée : publier doit être un geste délibéré.
    it('crée une playlist privée par défaut', async () => {
      prismaMock.playlist.create.mockResolvedValue({ id: 3 });

      await service.createPlaylist({ name: 'Warmups' }, user.userId);

      expect(prismaMock.playlist.create).toHaveBeenCalledWith({
        data: {
          name: 'Warmups',
          description: null,
          isPublic: false,
          userId: user.userId,
        },
        omit: { userId: true },
      });
    });

    it('respecte isPublic quand le client le fournit', async () => {
      prismaMock.playlist.create.mockResolvedValue({ id: 3 });

      await service.createPlaylist(
        { name: 'Warmups', isPublic: true },
        user.userId,
      );

      const [arg] = prismaMock.playlist.create.mock.calls[0] as [
        { data: { isPublic: boolean } },
      ];
      expect(arg.data.isPublic).toBe(true);
    });
  });

  describe('propriété', () => {
    beforeEach(() => {
      prismaMock.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });
      prismaMock.playlistBoulder.findUnique.mockResolvedValue(null);
    });

    // Toutes les écritures passent par assertOwnerShip. Les couvrir une par une
    // évite qu'un futur refactor en oublie une en silence.
    it.each([
      ['removePlaylist', () => service.removePlaylist(stranger, 3)],
      ['update', () => service.update({ name: 'x' }, stranger, 3)],
      ['addBoulder', () => service.addBoulder(stranger, { boulderId: 10 }, 3)],
      ['removeBoulder', () => service.removeBoulder(stranger, 10, 3)],
    ])('%s refuse un non-propriétaire', async (_label, call) => {
      await expect(call()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addBoulder', () => {
    beforeEach(() => {
      prismaMock.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prismaMock.playlistBoulder.create.mockResolvedValue({ id: 1 });
    });

    it('ajoute le bloc à la playlist', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });
      prismaMock.playlistBoulder.findUnique.mockResolvedValue(null);

      await service.addBoulder(user, { boulderId: 10, position: 2 }, 3);

      expect(prismaMock.playlistBoulder.create).toHaveBeenCalledWith({
        data: { boulderId: 10, playlistId: 3, position: 2 },
      });
    });

    it('rejette un bloc inexistant', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(
        service.addBoulder(user, { boulderId: 404 }, 3),
      ).rejects.toThrow(NotFoundException);
    });

    // La contrainte unique (boulderId, playlistId) le garantirait en base, mais
    // en levant une erreur Prisma brute : on préfère un 409 explicite.
    it('rejette un bloc déjà présent', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });
      prismaMock.playlistBoulder.findUnique.mockResolvedValue({ id: 77 });

      await expect(
        service.addBoulder(user, { boulderId: 10 }, 3),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.playlistBoulder.create).not.toHaveBeenCalled();
    });
  });

  describe('removeBoulder', () => {
    it('supprime par la clé composite', async () => {
      prismaMock.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prismaMock.boulder.findUnique.mockResolvedValue({ id: 10 });

      await service.removeBoulder(user, 10, 3);

      expect(prismaMock.playlistBoulder.delete).toHaveBeenCalledWith({
        where: { boulderId_playlistId: { boulderId: 10, playlistId: 3 } },
      });
    });
  });
});
