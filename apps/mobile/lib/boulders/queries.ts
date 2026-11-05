import {
  keepPreviousData,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  useMutation,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../api/client';
import {
  BoulderDetail,
  BoulderFilters,
  BoulderLiked,
  BoulderLikeStatus,
  BoulderSummary,
  PaginatedResponse,
} from './types';
import { boulderKeys, boulderLikedKeys } from './keys';
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
    enabled: Number.isFinite(id),
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
      // `angleGrades` vide : l'écran retombe sur la cotation du créateur à
      // son inclinaison le temps de recevoir la vraie réponse.
      return found
        ? {
            ...found,
            description: null,
            holds: [],
            publicNotes: [],
            angleGrades: [],
          }
        : undefined;
    },
  });
}

export function fetchMyBouldersLiked(): Promise<BoulderLiked[]> {
  return api.get<BoulderLiked[]>('/boulders/likes/me');
}

// Non paginé côté serveur, comme les playlists : un useQuery simple suffit.
export function useMyLikedBoulders(): UseQueryResult<BoulderLiked[], Error> {
  return useQuery({
    queryKey: boulderLikedKeys.mine(),
    queryFn: fetchMyBouldersLiked,
  });
}

// `angleDegrees` undefined tant que l'écran ne la connaît pas (bloc encore en
// chargement) : la requête attend, le cœur reste grisé.
export function useBoulderLike(
  boulderId: number,
  angleDegrees: number | undefined,
): UseQueryResult<BoulderLikeStatus, Error> {
  return useQuery({
    enabled: Number.isFinite(boulderId) && angleDegrees !== undefined,
    // `?? 0` ne sert qu'au typage : la requête ne part pas sans inclinaison.
    queryKey: boulderLikedKeys.status(boulderId, angleDegrees ?? 0),
    queryFn: () => {
      return api.get<BoulderLikeStatus>(
        `/boulders/${boulderId}/like?angle=${angleDegrees}`,
      );
    },
  });
}

type ToggleLikeInput = {
  boulderId: number;
  angleDegrees: number;
  liked: boolean;
};

// Une seule mutation pour les deux sens : `liked` est l'état affiché par le
// cœur au moment du tap. Liké → on retire, pas liké → on pose. PUT et DELETE
// étant idempotents, un double envoi ne peut pas inverser l'intention.
export function useToggleBoulderLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ boulderId, angleDegrees, liked }: ToggleLikeInput) => {
      const url = `/boulders/${boulderId}/like?angle=${angleDegrees}`;
      if (liked) {
        await api.delete(url);
      } else {
        await api.put<BoulderLikeStatus>(url);
      }
    },
    // Mise à jour optimiste : le cœur bascule au tap, sans attendre le réseau.
    onMutate: async ({ boulderId, angleDegrees, liked }: ToggleLikeInput) => {
      const key = boulderLikedKeys.status(boulderId, angleDegrees);
      // Une lecture encore en vol écraserait la valeur optimiste avec l'état
      // d'avant le tap : on l'annule.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoulderLikeStatus>(key);
      queryClient.setQueryData<BoulderLikeStatus>(key, { liked: !liked });
      // Renvoyé à onError (le « contexte ») pour pouvoir revenir en arrière.
      return { previous };
    },
    onError: (_error, { boulderId, angleDegrees }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          boulderLikedKeys.status(boulderId, angleDegrees),
          context.previous,
        );
      }
    },
    // onSettled : après un échec aussi, on relit l'état réel. La racine
    // `likes` couvre à la fois le cœur et la liste « Liked ».
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boulderLikedKeys.all });
    },
  });
}
