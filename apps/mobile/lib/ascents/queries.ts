import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ascent, LogAscentPayload } from './types';
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
