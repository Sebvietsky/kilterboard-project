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
 * On passe par /users/me et non /auth/me : les deux renvoient la même chose,
 * mais seul le premier porte les compteurs `_count`. Cette query est donc la
 * seule source de profil « riche » ; AuthContext reste la source d'identité.
 */
export function useUser(username?: string): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: username ? userKeys.profile(username) : userKeys.me(),
    queryFn: () => (username ? fetchUserProfile(username) : fetchMyProfile()),
  });
}
