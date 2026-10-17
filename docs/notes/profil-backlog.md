# Profil — backlog

Écran construit le 2026-07-30 (#44) : `components/profile/ProfileView.tsx`, paramétré par un `username?` optionnel (absent = profil courant), consommé par `app/(tabs)/profile.tsx`. Volontairement hors de `app/` pour servir aussi une future route `/user/[username]`.

## Enrichissements différés (2026-07-30)

- **Taux de flash** : aucun agrégat par statut n'est exposé par l'API. Même prérequis que les stats agrégées de `docs/notes/boulder-detail.md`. À traiter ensemble.
- **Ascensions récentes** : `getPublicProfile` ne les inclut pas. Demande un `include` sur les `Ascent` (avec limite) ou un endpoint paginé dédié.
- **Bouton Follow sur un profil tiers** : l'emplacement est réservé et commenté dans `ProfileView`, mais aucun endpoint ne dit si on suit déjà la personne (pas d'`isFollowing`). Prérequis backend avant toute UI.
- **Edit profile** : bouton présent mais `disabled`. `PATCH /users/me` existe (`UpdateUserDto` : bio, avatarUrl, country, isPublic, gradeSystem). Il ne manque que le formulaire.
- **`displayName` n'existe pas** dans le modèle `User`, seulement `username`. Ne pas l'introduire dans une maquette sans ajouter le champ.

## Décisions structurantes (reprises dans DECISIONS.md)

- `UserProfile = Omit<User, 'email' | 'role'> & { _count }` : `GET /users/:username` ne renvoie jamais ces champs, sinon la route servirait un annuaire d'adresses et la liste des ADMIN. La règle est portée par le type.
- `GET /auth/me` supprimé. `UsersService.getMe` lève 401 et non 404 quand le token ne désigne aucun compte : le mobile ne se déconnecte que sur un 401, un 404 le ferait boucler au bootstrap.
- `logout()` appelle `queryClient.clear()` dans `AuthContext` : la déconnexion arrive aussi par `onAuthFailure`, qui ne passe par aucun écran.
