import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  Ascent,
  AscentStatus,
  LogAscentInput,
  MyAscent,
  MyProject,
} from './types';
import { api } from '../api/client';
import { boulderKeys } from '../boulders/keys';
import { ascentKeys } from './keys';

export function useLogAscent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ comment, visibility, ...ascent }: LogAscentInput) => {
      const created = await api.post<Ascent>('/ascents', ascent);
      if (comment?.trim()) {
        await api.post(`/ascents/${created.id}/notes`, {
          content: comment.trim(),
          visibility: visibility ?? 'PRIVATE',
        });
      }
      return created;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: boulderKeys.detail(variables.boulderId),
      });
      queryClient.invalidateQueries({
        queryKey: boulderKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: ascentKeys.byBoulder(variables.boulderId),
      });
      // Logger une ascension ouvre un projet ou en referme un : la liste de
      // Library est périmée dans les deux cas.
      queryClient.invalidateQueries({
        queryKey: ascentKeys.myProjects(),
      });
    },
  });
}

export function fetchMyAscentsOnBoulder(
  boulderId: number,
): Promise<MyAscent[]> {
  return api.get<MyAscent[]>(`/ascents/me/${boulderId}`);
}

export function useMyAscentsOnBoulder(
  boulderId: number,
): UseQueryResult<MyAscent[], Error> {
  return useQuery({
    enabled: Number.isFinite(boulderId),
    queryKey: ascentKeys.byBoulder(boulderId),
    queryFn: () => fetchMyAscentsOnBoulder(boulderId),
  });
}

export function fetchMyProjects(): Promise<MyProject[]> {
  return api.get<MyProject[]>('/users/me/projects');
}

// Route dans le module Users côté backend, mais query rangée ici : la donnée
// EST une ascension, et sa clé descend de ascentKeys — c'est l'invalidation
// qui doit rester cohérente, pas le préfixe d'URL.
// Non paginé côté serveur, d'où un useQuery simple.
export function useMyProjects(): UseQueryResult<MyProject[], Error> {
  return useQuery({
    queryKey: ascentKeys.myProjects(),
    queryFn: fetchMyProjects,
  });
}

export function deriveAvailableStatuses(ascents: MyAscent[]): AscentStatus[] {
  const hasAnyAscent = ascents.length > 0;
  const hasActiveProject = ascents.some((a) => a.status === 'PROJECT');

  if (hasActiveProject) return [];
  if (hasAnyAscent) return ['SENT'];

  return ['FLASH', 'SENT', 'PROJECT'];
}
