import {
  keepPreviousData,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../api/client';
import {
  BoulderDetail,
  BoulderFilters,
  BoulderSummary,
  PaginatedResponse,
} from './types';
import { boulderKeys } from './keys';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';

export function fetchBoulders(
  filters: BoulderFilters,
  pageParams: number,
): Promise<PaginatedResponse<BoulderSummary>> {
  const params = new URLSearchParams();
  for (const key in filters) {
    const typedKey = key as keyof BoulderFilters;
    if (filters[typedKey] !== undefined) {
      if (typedKey === 'tags') {
        filters.tags?.forEach((t) => params.append('tags', t));
      } else {
        params.set(key, String(filters[typedKey]));
      }
    }
  }
  params.set('page', String(pageParams));
  params.set('limit', '20');
  return api.get<PaginatedResponse<BoulderSummary>>(
    `/boulders?${params.toString()}`,
  );
}

export function useBouldersInfinite(
  filters: BoulderFilters,
): UseInfiniteQueryResult<BoulderSummary[], Error> {
  return useInfiniteQuery({
    queryKey: boulderKeys.list(filters),
    queryFn: ({ pageParam }) => fetchBoulders(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    select: (data) => data.pages.flatMap((p) => p.data),
  });
}

export function fetchBoulderId(id: number): Promise<BoulderDetail> {
  return api.get<BoulderDetail>(`/boulders/${id}`);
}

export function useBoulder(id: number): UseQueryResult<BoulderDetail, Error> {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: boulderKeys.detail(id),
    queryFn: () => fetchBoulderId(id),
    placeholderData: () => {
      const lists = queryClient.getQueriesData<
        InfiniteData<PaginatedResponse<BoulderSummary>>
      >({ queryKey: boulderKeys.lists() });
      const allSummaries = lists
        .flatMap((p) => p[1]?.pages ?? [])
        .flatMap((p) => p.data);
      const found = allSummaries.find((b) => b?.id === id);
      return found
        ? { ...found, description: null, holds: [], publicNotes: [] }
        : undefined;
    },
  });
}
