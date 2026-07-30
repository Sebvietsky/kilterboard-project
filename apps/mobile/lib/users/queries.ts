import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../api/client';
import { userKeys } from './keys';
import type { UserProfile } from './types';

export function fetchMyProfile(): Promise<UserProfile> {
  return api.get<UserProfile>('/users/me');
}

export function fetchUserProfile(username: string): Promise<UserProfile> {
  return api.get<UserProfile>(`/users/${encodeURIComponent(username)}`);
}

/**
 * Profil courant si `username` est absent, profil d'un tiers sinon.
 *
 * Une seule surface d'appel pour les deux cas : l'écran de profil est le même,
 * seules les actions changent. La route diffère parce que /users/me n'a pas
 * besoin de connaître son propre username — et parce que la version publique
 * n'expose pas l'email.
 *
 * /users/me est l'unique route du compte courant : GET /auth/me faisait la
 * même requête et a été supprimé. AuthContext l'appelle aussi, mais pour
 * l'IDENTITÉ (bootstrap, login) ; cette query est la source du PROFIL.
 */
export function useUser(username?: string): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: username ? userKeys.profile(username) : userKeys.me(),
    queryFn: () => (username ? fetchUserProfile(username) : fetchMyProfile()),
  });
}
