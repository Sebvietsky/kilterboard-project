import { keepPreviousData, useInfiniteQuery, UseInfiniteQueryResult } from "@tanstack/react-query";
import { api } from "../api/client";
import { BoulderFilters, BoulderSummary, PaginatedResponse } from "./types";
import { boulderKeys } from "./keys";

export function fetchBoulders(filters: BoulderFilters, pageParams: number): Promise<PaginatedResponse<BoulderSummary>> {
  const params = new URLSearchParams()
  for (const key in filters) {
  const typedKey = key as keyof BoulderFilters;
    if (filters[typedKey] !== undefined) {
      if (typedKey === "tags") {
        filters.tags?.forEach(t => params.append("tags", t))
      } else {
        params.set(key, String(filters[typedKey]))
      }
    }
  }
  params.set("page", String(pageParams));
  params.set("limit", "20");
  return api.get<PaginatedResponse<BoulderSummary>>(`/boulders?${params.toString()}`)
}

export function useBouldersInfinite(filters: BoulderFilters): UseInfiniteQueryResult<BoulderSummary[], Error> {

  return useInfiniteQuery({
    queryKey: boulderKeys.list(filters),
    queryFn: ({ pageParam }) => fetchBoulders(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined, staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    select: (data) => data.pages.flatMap((p) => p.data)
  })
}
