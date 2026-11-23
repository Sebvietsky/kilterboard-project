import { BoulderFilters } from './types';

export const boulderKeys = {
  all: ['boulders'] as const,
  lists: () => [...boulderKeys.all, 'list'] as const,
  list: (filters: BoulderFilters) => [...boulderKeys.lists(), filters] as const,
  details: () => [...boulderKeys.all, 'detail'] as const,
  detail: (id: number) => [...boulderKeys.details(), id] as const,
};

export const boulderLikedKeys = {
  all: ['likes'] as const,
  // Un like par bloc ET par inclinaison : changer d'inclinaison dans le
  // sélecteur lit un autre état, sans écraser celui de la précédente.
  status: (boulderId: number, angleDegrees: number) =>
    [...boulderLikedKeys.all, boulderId, angleDegrees] as const,
  mine: () => [...boulderLikedKeys.all, 'mine'] as const,
};
