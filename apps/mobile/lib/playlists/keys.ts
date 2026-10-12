export const playlistKeys = {
  all: ['playlists'] as const,
  mine: () => [...playlistKeys.all, 'mine'] as const,
  // Descend de `mine` : ajouter ou retirer un bloc invalide `all`, donc à la
  // fois les compteurs de Library et les coches de la feuille d'ajout.
  mineForBoulder: (boulderId: number) =>
    [...playlistKeys.mine(), { boulderId }] as const,
  details: () => [...playlistKeys.all, 'detail'] as const,
  detail: (id: number) => [...playlistKeys.details(), id] as const,
};
