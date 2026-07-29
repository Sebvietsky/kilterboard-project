import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { Ascent, AscentStatus, LogAscentInput, MyAscent } from './types';
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

export function deriveAvailableStatuses(ascents: MyAscent[]): AscentStatus[] {
  const hasAnyAscent = ascents.length > 0;
  const hasActiveProject = ascents.some((a) => a.status === 'PROJECT');

  if (hasActiveProject) return [];
  if (hasAnyAscent) return ['SENT'];

  return ['FLASH', 'SENT', 'PROJECT'];
}
