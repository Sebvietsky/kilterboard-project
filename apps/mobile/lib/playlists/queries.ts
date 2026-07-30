import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../api/client';
import { playlistKeys } from './keys';
import type { PlaylistSummary } from './types';

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
