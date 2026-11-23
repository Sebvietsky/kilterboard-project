import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../api/client';
import { boulderKeys } from '../boulders/keys';
import { userKeys } from '../users/keys';
import { draftKeys } from './keys';
import type { BoulderWritten, Draft, DraftHold, DraftSummary } from './types';

export function useMyDrafts(): UseQueryResult<DraftSummary[], Error> {
  return useQuery({
    queryKey: draftKeys.mine(),
    queryFn: () => api.get<DraftSummary[]>('/boulders/drafts'),
  });
}

export function useDraft(id: number | undefined): UseQueryResult<Draft, Error> {
  return useQuery({
    enabled: id !== undefined,
    queryKey: draftKeys.detail(id ?? -1),
    queryFn: () => api.get<Draft>(`/boulders/drafts/${id}`),
  });
}

export type DraftFields = {
  name: string;
  description: string | null;
  gradeRank: number;
  holds: DraftHold[];
  tags: string[]; // slugs, 3 au plus
};

// Sans `draftId`, crée le brouillon (`POST`, avec son inclinaison) ; avec,
// le modifie (`PATCH`, qui remplace toutes les prises). L'inclinaison n'est
// envoyée qu'à la création : elle est fixée ensuite.
export type SaveDraftInput =
  | { draftId: undefined; angleDegrees: number; fields: DraftFields }
  | { draftId: number; fields: DraftFields };

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveDraftInput) => {
      const { description, ...rest } = input.fields;
      if (input.draftId === undefined) {
        // `null` -> absent : à la création, pas de description = rien.
        return api.post<BoulderWritten>('/boulders', {
          ...rest,
          angleDegrees: input.angleDegrees,
          ...(description !== null && { description }),
        });
      }
      // En modification, `null` efface une description existante.
      return api.patch<BoulderWritten>(`/boulders/${input.draftId}`, {
        ...rest,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftKeys.all });
    },
  });
}

export function usePublishDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: number) =>
      api.patch<BoulderWritten>(`/boulders/${draftId}/publish`),
    // Publié, il n'est plus un brouillon : sa lecture répondrait 404.
    onSuccess: (_data, draftId) => {
      queryClient.removeQueries({ queryKey: draftKeys.detail(draftId) });
    },
    // Après un échec aussi : un 409 (déjà publié) veut dire que la liste des
    // brouillons était fausse.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: draftKeys.mine() });
      // Le bloc publié entre dans Explore et dans mes blocs du profil.
      queryClient.invalidateQueries({ queryKey: boulderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: boulderKeys.mine() });
    },
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: number) => api.delete(`/boulders/${draftId}`),
    onSuccess: (_data, draftId) => {
      // Oublié et non relu : sa lecture répondrait 404.
      queryClient.removeQueries({ queryKey: draftKeys.detail(draftId) });
    },
    // Après un échec aussi : un 409 (publié entre-temps) veut dire que la
    // liste était fausse.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: draftKeys.mine() });
      // Le compteur « Boulders » du profil compte aussi les brouillons.
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
