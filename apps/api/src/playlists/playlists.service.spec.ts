import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
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
  angle: { findUnique: jest.fn() },
  playlistBoulder: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const user = { userId: 1, role: Role.USER, username: 'seb' };
const stranger = { userId: 999, role: Role.USER, username: 'other' };

// Un bloc public et publié, créé par quelqu'un d'autre.
const publicBoulder = { id: 10, isPublic: true, isDraft: false, creatorId: 42 };

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
    prismaMock.angle.findUnique.mockResolvedValue({ id: 7 }); // 50°

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
    // Le même bloc (créé à 40°, angleId 5) à 40° et à 50° : deux entrées, et
    // la cotation du créateur ne vaut que pour la sienne.
    // Le même bloc à 40° et à 50° : deux entrées, chacune avec la cotation
    // de son inclinaison (la ligne boulder_angles correspondante).
    it('donne à chaque entrée son inclinaison et la cotation qui y vaut', async () => {
      prismaMock.playlist.findUnique.mockResolvedValue({
        ...ownedPlaylist,
        playlistBoulders: [
          {
            boulderId: 10,
            angle: { valueDegrees: 40 },
            boulder: { name: 'Crimpy' },
            boulderAngle: { grade: { rank: 18 } },
          },
          {
            boulderId: 10,
            angle: { valueDegrees: 50 },
            boulder: { name: 'Crimpy' },
            boulderAngle: { grade: null },
          },
        ],
      });

      const { boulders } = await service.findOne(3, user);

      expect(boulders.map((b) => b.boulder)).toEqual([
        {
          id: 10,
          name: 'Crimpy',
          gradeRank: 18,
          angleDegrees: 40,
        },
        {
          id: 10,
          name: 'Crimpy',
          gradeRank: null,
          angleDegrees: 50,
        },
      ]);
    });
  });

  describe('findMine', () => {
    const row = {
      id: 1,
      userId: user.userId,
      name: 'Projets',
      description: null,
      isPublic: false,
      createdAt: new Date(),
      user: { username: 'seb' },
      _count: { playlistBoulders: 2 },
    };

    it('trie de la plus récente à la plus ancienne', async () => {
      prismaMock.playlist.findMany.mockResolvedValue([]);

      await service.findMine(user);

      const [arg] = prismaMock.playlist.findMany.mock.calls[0] as [
        { orderBy: unknown },
      ];
      expect(arg.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    });

    // Privées comprises : sans ce filtre, « mes playlists » serait celles de
    // tout le monde.
    it("ne lit que les playlists de l'utilisateur", async () => {
      prismaMock.playlist.findMany.mockResolvedValue([]);

      await service.findMine(user);

      const [arg] = prismaMock.playlist.findMany.mock.calls[0] as [
        { where: unknown },
      ];
      expect(arg.where).toEqual({ userId: user.userId });
    });

    it("n'expose pas containsBoulder quand aucun bloc n'est demandé", async () => {
      prismaMock.playlist.findMany.mockResolvedValue([row]);

      const [playlist] = await service.findMine(user);

      expect(playlist).not.toHaveProperty('containsBoulder');
    });

    it('indique, pour le bloc demandé, quelles playlists le contiennent', async () => {
      prismaMock.playlist.findMany.mockResolvedValue([
        { ...row, id: 1, playlistBoulders: [{ boulderId: 10 }] },
        { ...row, id: 2, playlistBoulders: [] },
      ]);

      const playlists = await service.findMine(user, {
        boulderId: 10,
        angleDegrees: 50,
      });

      expect(playlists.map((p) => [p.id, p.containsBoulder])).toEqual([
        [1, true],
        [2, false],
      ]);
    });

    // Le même bloc à une autre inclinaison est une autre entrée : la coche ne
    // vaut que pour l'inclinaison affichée.
    it("ne cherche le bloc qu'à l'inclinaison demandée", async () => {
      prismaMock.playlist.findMany.mockResolvedValue([]);

      await service.findMine(user, { boulderId: 10, angleDegrees: 50 });

      const [arg] = prismaMock.playlist.findMany.mock.calls[0] as [
        { include: { playlistBoulders: { where: unknown } } },
      ];
      expect(arg.include.playlistBoulders.where).toEqual({
        boulderId: 10,
        angle: { valueDegrees: 50 },
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
      prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);
      prismaMock.playlistBoulder.findUnique.mockResolvedValue(null);
    });

    // Toutes les écritures passent par assertOwnerShip. Les couvrir une par une
    // évite qu'un futur refactor en oublie une en silence.
    it.each([
      ['removePlaylist', () => service.removePlaylist(stranger, 3)],
      ['update', () => service.update({ name: 'x' }, stranger, 3)],
      [
        'addBoulder',
        () =>
          service.addBoulder(stranger, { boulderId: 10, angleDegrees: 50 }, 3),
      ],
      ['removeBoulder', () => service.removeBoulder(stranger, 10, 3, 50)],
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
      prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);
      prismaMock.playlistBoulder.findUnique.mockResolvedValue(null);

      await service.addBoulder(
        user,
        { boulderId: 10, angleDegrees: 50, position: 2 },
        3,
      );

      expect(prismaMock.playlistBoulder.create).toHaveBeenCalledWith({
        data: { boulderId: 10, playlistId: 3, angleId: 7, position: 2 },
      });
    });

    it('rejette une inclinaison inconnue', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);
      prismaMock.angle.findUnique.mockResolvedValue(null);

      await expect(
        service.addBoulder(user, { boulderId: 10, angleDegrees: 47 }, 3),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.playlistBoulder.create).not.toHaveBeenCalled();
    });

    it('rejette un bloc inexistant', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(null);

      await expect(
        service.addBoulder(user, { boulderId: 404, angleDegrees: 50 }, 3),
      ).rejects.toThrow(NotFoundException);
    });

    // B4 (décision du 2026-10-15) : un bloc privé ou brouillon n'existe que
    // pour son créateur. 404 et non 403 : révéler qu'il existe est déjà une
    // fuite, et une playlist publique exposerait son nom.
    it.each([
      ['privé', { ...publicBoulder, isPublic: false }],
      ['brouillon', { ...publicBoulder, isDraft: true }],
    ])("rejette en 404 le bloc %s d'un autre", async (_label, boulder) => {
      prismaMock.boulder.findUnique.mockResolvedValue(boulder);

      await expect(
        service.addBoulder(user, { boulderId: 10, angleDegrees: 50 }, 3),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.playlistBoulder.create).not.toHaveBeenCalled();
    });

    it('accepte le brouillon de son créateur', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue({
        ...publicBoulder,
        isPublic: false,
        isDraft: true,
        creatorId: user.userId,
      });
      prismaMock.playlistBoulder.findUnique.mockResolvedValue(null);

      await service.addBoulder(user, { boulderId: 10, angleDegrees: 50 }, 3);

      expect(prismaMock.playlistBoulder.create).toHaveBeenCalled();
    });

    // La clé (boulderId, playlistId, angleId) le garantirait en base, mais
    // en levant une erreur Prisma brute : on préfère un 409 explicite.
    it('rejette un bloc déjà présent à cette inclinaison', async () => {
      prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);
      prismaMock.playlistBoulder.findUnique.mockResolvedValue({ id: 77 });

      await expect(
        service.addBoulder(user, { boulderId: 10, angleDegrees: 50 }, 3),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.playlistBoulder.findUnique).toHaveBeenCalledWith({
        where: {
          boulderId_playlistId_angleId: {
            boulderId: 10,
            playlistId: 3,
            angleId: 7,
          },
        },
      });
      expect(prismaMock.playlistBoulder.create).not.toHaveBeenCalled();
    });
  });

  describe('removeBoulder', () => {
    it('supprime par la clé composite', async () => {
      prismaMock.playlist.findUnique.mockResolvedValue(ownedPlaylist);
      prismaMock.boulder.findUnique.mockResolvedValue(publicBoulder);

      await service.removeBoulder(user, 10, 3, 50);

      expect(prismaMock.playlistBoulder.delete).toHaveBeenCalledWith({
        where: {
          boulderId_playlistId_angleId: {
            boulderId: 10,
            playlistId: 3,
            angleId: 7,
          },
        },
      });
    });
  });
});
