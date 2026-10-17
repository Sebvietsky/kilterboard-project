export const sessionKeys = {
  all: ['sessions'] as const,
  // Toutes les clés descendent de `all` : une mutation qui touche une session
  // (start, end, log d'une ascension) invalide `all` sans les connaître. Finir
  // une session rafraîchit ainsi d'un coup la session active et l'historique.
  active: () => [...sessionKeys.all, 'active'] as const,
  mine: () => [...sessionKeys.all, 'mine'] as const,
  detail: (id: number) => [...sessionKeys.all, 'detail', id] as const,
};
