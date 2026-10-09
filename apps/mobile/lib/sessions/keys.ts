export const sessionKeys = {
  all: ['sessions'] as const,
  // La session active descend de `all` : une mutation qui la modifie (start,
  // end, log d'une ascension) peut invalider `all` sans connaître cette clé.
  active: () => [...sessionKeys.all, 'active'] as const,
};
