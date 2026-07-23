import { BoulderFilters } from './types';

export const boulderKeys = {
  all: ['boulders'] as const,
  lists: () => [...boulderKeys.all, 'list'] as const,
  list: (filters: BoulderFilters) => [...boulderKeys.lists(), filters] as const,
  details: () => [...boulderKeys.all, 'detail'] as const,
  detail: (id: number) => [...boulderKeys.details(), id] as const,
};
