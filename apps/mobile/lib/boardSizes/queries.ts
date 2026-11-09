import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { api } from '../api/client';
import { boardSizeKeys } from './keys';
import { BoardSize, BoardSizeSummary } from './types';

// Matériel importé du catalogue Kilter : il ne change pas pendant que l'app
// tourne, une lecture suffit.
const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;

export function useBoardSizes(): UseQueryResult<BoardSizeSummary[], Error> {
  return useQuery({
    queryKey: boardSizeKeys.list(),
    queryFn: () => api.get<BoardSizeSummary[]>('/board-sizes'),
    ...STATIC,
  });
}

export function useBoardSize(
  id: number | undefined,
): UseQueryResult<BoardSize, Error> {
  return useQuery({
    enabled: id !== undefined,
    queryKey: boardSizeKeys.detail(id ?? -1),
    queryFn: () => api.get<BoardSize>(`/board-sizes/${id}`),
    ...STATIC,
  });
}

// Taille dessinée sur le détail d'un bloc. Tant que la board connectée ne
// déclare pas la sienne, la première importée : la 12 x 12 with kickboard,
// seule taille du catalogue local.
export function useDefaultBoardSize(): UseQueryResult<BoardSize, Error> {
  const sizes = useBoardSizes();
  return useBoardSize(sizes.data?.[0]?.id);
}
