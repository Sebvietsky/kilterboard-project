import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { ActiveSession, Session, SessionDetail, SessionSummary } from './types';
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

export function fetchMySessions(): Promise<SessionSummary[]> {
  return api.get<SessionSummary[]>('/sessions/me');
}

// L'historique ne montre que les séances terminées où l'on a grimpé. La route
// renvoie aussi la session en cours, et les sessions vides (démarrées par
// erreur, ou fermées par le serveur sans aucun bloc) : du bruit dans une liste
// dont le but est de retrouver ses séances.
function selectPastSessions(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.filter(
    (session) => session.endedAt !== null && session._count.entries > 0,
  );
}

export function useMySessions(): UseQueryResult<SessionSummary[], Error> {
  return useQuery({
    queryKey: sessionKeys.mine(),
    queryFn: fetchMySessions,
    select: selectPastSessions,
  });
}

export function fetchSession(id: number): Promise<SessionDetail> {
  return api.get<SessionDetail>(`/sessions/${id}`);
}

export function useSession(id: number): UseQueryResult<SessionDetail, Error> {
  return useQuery({
    enabled: Number.isFinite(id),
    queryKey: sessionKeys.detail(id),
    queryFn: () => fetchSession(id),
  });
}

// Aucun corps : board, titre et note sont optionnels côté serveur, qui génère
// le titre par défaut. Une session déjà active donne un 409.
//
// Invalidation dans `onSettled` et non `onSuccess` : un échec est justement le
// signe que l'écran et le serveur ne sont plus d'accord (409 parce qu'une
// session tourne déjà, démarrée ailleurs). Relire l'état après une erreur
// sort l'utilisateur de l'impasse, au lieu de lui laisser un bouton Start qui
// échouera à chaque tap.
export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Session>('/sessions'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}

// L'id est celui de la SESSION, passé par l'écran qui tient déjà la session
// active. L'utilisateur, lui, vient du token : le serveur vérifie qu'il en est
// bien le propriétaire.
export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      api.patch<Session>(`/sessions/${sessionId}/end`),
    // `onSettled` pour la même raison que Start : un 409 « already ended »
    // (session fermée par le serveur après 2 h d'inactivité) doit faire
    // disparaître la session de l'écran, pas la laisser affichée.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}
