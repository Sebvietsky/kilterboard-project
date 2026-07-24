import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { Ascent, LogAscentPayload, MyAscent } from './types';
import { api } from '../api/client';
import { boulderKeys } from '../boulders/keys';
import { ascentKeys } from './keys';

export function useLogAscent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LogAscentPayload) =>
      api.post<Ascent>('/ascents', payload),
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
