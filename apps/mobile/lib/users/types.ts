import type { User } from '@/lib/auth/types';

// Compteurs renvoyés par l'API sous `_count`. Noms alignés sur les relations
// Prisma : followedBy = ceux qui me suivent, follows = ceux que je suis.
export interface ProfileCounts {
  followedBy: number;
  follows: number;
  boulders: number;
  ascents: number;
}

/**
 * Un profil affichable, à soi comme aux autres.
 *
 * Dérivé de `User` plutôt que redéclaré : les deux décrivent le même
 * utilisateur, et deux définitions parallèles divergeraient au premier champ
 * ajouté côté backend.
 *
 * `email` et `role` en sont retirés volontairement. GET /users/:username ne
 * les renvoie jamais — c'est une route consultable par n'importe quel compte
 * authentifié à partir du seul username. GET /users/me les renvoie encore,
 * mais les typer ici obligerait chaque consommateur à gérer des champs
 * absents une fois sur deux. En les excluant, le type dit ce qui est VRAI
 * dans les deux cas : un écran de profil ne peut pas afficher une adresse ni
 * un rôle qu'il n'a pas toujours. La règle de confidentialité est portée par
 * le type, pas par la discipline de celui qui l'utilise.
 *
 * Le rôle du compte COURANT reste disponible via AuthContext, qui est la
 * source d'identité — pas d'affichage.
 */
export type UserProfile = Omit<User, 'email' | 'role'> & {
  _count: ProfileCounts;
};
