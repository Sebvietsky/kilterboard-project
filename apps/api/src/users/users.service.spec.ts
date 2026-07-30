import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  userFollow: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
  ascent: { findMany: jest.fn() },
};

const me = 1;
const target = { id: 2, username: 'alice', isPublic: true };

// Les trois champs jamais exposés : le hash, et deux compteurs de gamification
// qui ne sont pas encore un contrat public.
const hiddenFields = { passwordHash: true, xpPoints: true, level: true };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getMe', () => {
    it('omet le hash du mot de passe', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: me });

      await service.getMe(me);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: me },
        omit: hiddenFields,
      });
    });

    it('rejette un utilisateur introuvable', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe(me)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('omet le hash de la réponse après mise à jour', async () => {
      prismaMock.user.update.mockResolvedValue({ id: me });

      await service.updateMe(me, { bio: 'grimpeur' });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: me },
        data: { bio: 'grimpeur' },
        omit: hiddenFields,
      });
    });
  });

  describe('getPublicProfile', () => {
    it('renvoie un profil public', async () => {
      prismaMock.user.findUnique.mockResolvedValue(target);

      await expect(service.getPublicProfile('alice')).resolves.toMatchObject({
        id: 2,
      });
    });

    // Un profil privé existe mais n'est pas consultable. Le 403 le dit — c'est
    // un choix assumé face au 404, qui masquerait jusqu'à son existence.
    it('refuse un profil privé', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...target,
        isPublic: false,
      });

      await expect(service.getPublicProfile('alice')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejette un username inconnu', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getPublicProfile('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('follow', () => {
    it('crée le lien de suivi', async () => {
      prismaMock.user.findUnique.mockResolvedValue(target);
      prismaMock.userFollow.findUnique.mockResolvedValue(null);
      prismaMock.userFollow.create.mockResolvedValue({ id: 1 });

      await service.follow(me, 'alice');

      expect(prismaMock.userFollow.create).toHaveBeenCalledWith({
        data: { followerId: me, followingId: target.id },
      });
    });

    // Sans cette garde, un utilisateur gonflerait son propre compteur
    // d'abonnés — et la contrainte d'unicité ne l'attraperait pas, les deux
    // colonnes ayant simplement la même valeur.
    it('refuse de se suivre soi-même', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...target, id: me });

      await expect(service.follow(me, 'seb')).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.userFollow.create).not.toHaveBeenCalled();
    });

    it('refuse un suivi en double', async () => {
      prismaMock.user.findUnique.mockResolvedValue(target);
      prismaMock.userFollow.findUnique.mockResolvedValue({ id: 5 });

      await expect(service.follow(me, 'alice')).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejette un utilisateur cible inconnu', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.follow(me, 'ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unfollow', () => {
    it('supprime le lien par sa clé composite', async () => {
      prismaMock.user.findUnique.mockResolvedValue(target);
      prismaMock.userFollow.findUnique.mockResolvedValue({ id: 5 });

      await service.unfollow(me, 'alice');

      expect(prismaMock.userFollow.delete).toHaveBeenCalledWith({
        where: {
          followerId_followingId: { followerId: me, followingId: target.id },
        },
      });
    });

    it('rejette un lien qui nexiste pas', async () => {
      prismaMock.user.findUnique.mockResolvedValue(target);
      prismaMock.userFollow.findUnique.mockResolvedValue(null);

      await expect(service.unfollow(me, 'alice')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyProjects', () => {
    // L'onglet Projects ne montre que les projets en cours : un projet complété
    // devient un SENT sur la même ligne, il doit donc disparaître d'ici.
    it('ne remonte que les ascensions au statut PROJECT', async () => {
      prismaMock.ascent.findMany.mockResolvedValue([]);

      await service.getMyProjects(me);

      const [arg] = prismaMock.ascent.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(arg.where).toEqual({ userId: me, status: 'PROJECT' });
    });
  });
});
