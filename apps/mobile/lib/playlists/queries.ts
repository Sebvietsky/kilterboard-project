import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../api/client';
import { playlistKeys } from './keys';
import type {
  CreatedPlaylist,
  PlaylistDetail,
  PlaylistForBoulder,
  PlaylistSummary,
} from './types';

export function fetchMyPlaylists(): Promise<PlaylistSummary[]> {
  return api.get<PlaylistSummary[]>('/playlists/me');
}

// Non paginé côté serveur : findMine fait un findMany sans skip/take. Un
// useQuery simple suffit donc — passer par useInfiniteQuery simulerait une
// pagination que l'API ne rend pas.
export function useMyPlaylists(): UseQueryResult<PlaylistSummary[], Error> {
  return useQuery({
    queryKey: playlistKeys.mine(),
    queryFn: fetchMyPlaylists,
  });
}

export function fetchMyPlaylistsForBoulder(
  boulderId: number,
): Promise<PlaylistForBoulder[]> {
  return api.get<PlaylistForBoulder[]>(`/playlists/me?boulderId=${boulderId}`);
}

// `enabled` : la feuille d'ajout est montée avec l'écran du bloc, mais la
// requête ne part qu'à son ouverture.
export function useMyPlaylistsForBoulder(
  boulderId: number,
  enabled: boolean,
): UseQueryResult<PlaylistForBoulder[], Error> {
  return useQuery({
    enabled: enabled && Number.isFinite(boulderId),
    queryKey: playlistKeys.mineForBoulder(boulderId),
    queryFn: () => fetchMyPlaylistsForBoulder(boulderId),
  });
}

type PlaylistBoulderInput = { playlistId: number; boulderId: number };

// Une seule mutation pour les deux sens : la feuille bascule l'appartenance
// d'un tap, et c'est l'état affiché (`containsBoulder`) qui dit lequel faire.
export function useTogglePlaylistBoulder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      boulderId,
      contains,
    }: PlaylistBoulderInput & { contains: boolean }) => {
      if (contains) {
        await api.delete(`/playlists/${playlistId}/boulders/${boulderId}`);
      } else {
        await api.post(`/playlists/${playlistId}/boulders`, { boulderId });
      }
    },
    // onSettled : après un échec aussi, on relit l'état réel. Un 409 « déjà
    // dans la playlist » signifie justement que la coche affichée était fausse.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.all });
    },
  });
}

// Crée une playlist et y range le bloc dans la foulée : depuis la feuille
// d'ajout, créer une playlist n'a de sens que pour y mettre ce bloc.
export function useCreatePlaylistWithBoulder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      boulderId,
    }: {
      name: string;
      boulderId: number;
    }) => {
      const playlist = await api.post<CreatedPlaylist>('/playlists', { name });
      await api.post(`/playlists/${playlist.id}/boulders`, { boulderId });
      return playlist;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.all });
    },
  });
}

export function fetchPlaylist(id: number): Promise<PlaylistDetail> {
  return api.get<PlaylistDetail>(`/playlists/${id}`);
}

export function usePlaylist(id: number): UseQueryResult<PlaylistDetail, Error> {
  return useQuery({
    enabled: Number.isFinite(id),
    queryKey: playlistKeys.detail(id),
    queryFn: () => fetchPlaylist(id),
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: number) => api.delete(`/playlists/${playlistId}`),
    onSuccess: (_data, playlistId) => {
      // `removeQueries` avant l'invalidation : le détail de la playlist
      // supprimée ne doit pas être relu (il répondrait 404), seulement oublié.
      queryClient.removeQueries({ queryKey: playlistKeys.detail(playlistId) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.mine() });
    },
  });
}

export type UpdatePlaylistInput = {
  playlistId: number;
  name: string;
  description: string | null;
  isPublic: boolean;
};

export function useUpdatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, ...changes }: UpdatePlaylistInput) =>
      api.patch(`/playlists/${playlistId}`, changes),
    // `all` : le nom et la visibilité s'affichent dans le détail, dans
    // Library et dans la feuille « Add to playlist ».
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.all });
    },
  });
}
