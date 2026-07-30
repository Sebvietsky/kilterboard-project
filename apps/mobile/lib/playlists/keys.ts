export const playlistKeys = {
  all: ['playlists'] as const,
  mine: () => [...playlistKeys.all, 'mine'] as const,
  details: () => [...playlistKeys.all, 'detail'] as const,
  detail: (id: number) => [...playlistKeys.details(), id] as const,
};
