// `me` a sa propre clé plutôt que d'être rangé sous profile(username) : au
// moment de la requête on ne connaît pas encore le username du compte courant,
// et deux clés pour la même personne feraient cohabiter deux copies en cache.
export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  profiles: () => [...userKeys.all, 'profile'] as const,
  profile: (username: string) => [...userKeys.profiles(), username] as const,
};
