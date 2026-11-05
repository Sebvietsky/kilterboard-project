export const ascentKeys = {
  all: ['ascents'] as const,
  byBoulder: (boulderId: number) =>
    [...ascentKeys.all, 'boulder', boulderId] as const,
  // Les projets sont des ascensions filtrées par statut : leur clé descend de
  // `all`, ce qui les rend invalidables avec le reste des ascensions.
  myProjects: () => [...ascentKeys.all, 'me', 'projects'] as const,
  // Racine de l'historique : invalider `myHistory()` rafraîchit l'aperçu du
  // profil et la liste complète.
  myHistory: () => [...ascentKeys.all, 'me', 'history'] as const,
  myHistoryList: () => [...ascentKeys.myHistory(), 'list'] as const,
  myHistoryRecent: () => [...ascentKeys.myHistory(), 'recent'] as const,
};
