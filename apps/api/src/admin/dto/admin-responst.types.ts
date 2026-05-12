import { Prisma } from '../../generated/prisma/client';

// Type inféré pour findAllUsers
export type AdminUserResult = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    email: true;
    role: true;
    country: true;
    isPublic: true;
    createdAt: true;
    _count: {
      select: { ascents: true; boulders: true; followedBy: true };
    };
  };
}>;

// Type inféré pour findAllBoulders
export type AdminBoulderResult = Prisma.BoulderGetPayload<{
  include: {
    creator: { select: { username: true } };
    grade: { select: { vScale: true; rank: true } };
    _count: { select: { ascents: true } };
  };
}>;

// Type inféré pour findAllPlaylists
export type AdminPlaylistResult = Prisma.PlaylistGetPayload<{
  include: {
    user: { select: { username: true } };
    _count: { select: { playlistBoulders: true } };
  };
}>;
