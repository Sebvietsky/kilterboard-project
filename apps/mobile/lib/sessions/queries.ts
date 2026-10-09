import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { ActiveSession } from './types';
import { api } from '../api/client';
import { sessionKeys } from './keys';

// Sans session active, le serveur répond 200 avec un corps vide : c'est un
// état normal, pas une erreur, d'où `getOrNull` et non `get`.
export function fetchActiveSession(): Promise<ActiveSession | null> {
  return api.getOrNull<ActiveSession>('/sessions/active');
}

export function useActiveSession(): UseQueryResult<
  ActiveSession | null,
  Error
> {
  return useQuery({
    queryKey: sessionKeys.active(),
    queryFn: fetchActiveSession,
  });
}
