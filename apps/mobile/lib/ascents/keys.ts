export const ascentKeys = {
  all: ['ascents'] as const,
  byBoulder: (boulderId: number) =>
    [...ascentKeys.all, 'boulder', boulderId] as const,
  // Les projets sont des ascensions filtrées par statut : leur clé descend de
  // `all`, ce qui les rend invalidables avec le reste des ascensions.
  myProjects: () => [...ascentKeys.all, 'me', 'projects'] as const,
};
