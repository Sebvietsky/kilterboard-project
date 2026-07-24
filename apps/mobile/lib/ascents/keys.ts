export const ascentKeys = {
  all: ['ascents'] as const,
  byBoulder: (boulderId: number) =>
    [...ascentKeys.all, 'boulder', boulderId] as const,
};
