# Décisions et état courant

Ce fichier est la source de vérité entre deux sessions. Il prime sur `docs/STATUS.md`.
En fin de session, l'agent propose un diff de ce fichier et Seb le valide avant écriture.
Garder le fichier court : une ligne par fait, avec une date pour chaque décision.
Le détail de conception vit dans `docs/notes/` (non importé) : lire la note du sujet avant d'y travailler.

Dernière mise à jour : 2026-10-08

## Chantier en cours

**Prochaine action :** Seb écrit `apps/mobile/lib/sessions/types.ts` (`Session` et `ActiveSession`) sur `feature/session-screen`, à partir des JSON de `docs/notes/session-screen.md`. L'agent relit.

- Objectif : écran Session mobile, cycle de vie seul (start / end, chrono, blocs faits). Sans BLE.
- Branche `feature/session-screen` : alignée sur `develop` (`3b555a0`), aucun commit propre. Côté mobile rien n'est commencé : `apps/mobile/lib/sessions/` n'existe pas et `app/(tabs)/session.tsx` est un placeholder.
- PR ouvertes le 2026-10-08, à fusionner dans `develop` : #54 (`fix/session-active-unique-index`, index partiel unique) et #55 (`chore/docs-decisions`, ce fichier). Rebaser `feature/session-screen` ensuite.
- Plan proposé (non figé) — après les types : `sessionKeys`, `useActiveSession` (via `api.getOrNull`), `useStartSession`, `useEndSession`, invalidations croisées avec `ascentKeys`.
- Plan proposé (non figé) — puis l'écran : loading / erreur / `null` → Start / session en cours (chrono dérivé de `startedAt`, liste des blocs, End).
- Avant l'étape « liste des blocs » de l'écran, sur une branche séparée : rattachement implicite de `sessionId`, sinon la liste reste vide. Voir `docs/notes/sessions-backend.md`.

## Travail non commité

- `apps/api/bruno/environments/Local.bru` : variables de test que Seb change au fil de l'eau. Ne jamais commiter.
- `apps/mobile/.env` (ignoré par git) : pointe sur `172.20.10.10`, l'IP du Mac en partage de connexion. À recorriger au retour sur la box, puis relancer Metro avec `--clear`.

## Décisions tranchées (ne pas rouvrir sans raison nouvelle)

Sessions
- **2026-07-31 · Rattachement des ascensions à la session : implicite.** Si `sessionId` est absent, le serveur résout la session active. `sessionId: null` explicite = hors session. Pas encore implémenté.
- **2026-10-08 · Index partiel unique fait** (#54), avant l'écran et non après. Déclaré dans `schema.prisma` par `@@unique(..., where:)` avec la preview feature `partialIndexes` (Prisma 7.8), pas en SQL manuel. Le `findFirst` de `startSession` reste : il donne le 409 lisible, l'index garantit.
- **2026-09-29 · Sessions zombies** : fermeture automatique côté serveur au-delà d'environ 6 h. Mécanisme à concevoir.
- **2026-09-29 · `GET /sessions/active`** renvoie la board et les ascensions avec cote, angle et `attemptsCount`. Pas de rating ni de grade ressenti : le critère est ce que l'écran affiche.
- **2026-07-31 · BLE gelé**, hors périmètre de l'écran Session. Lib, architecture et source des données déjà choisies : `docs/notes/ble-reprise.md`.

API
- **2026-09-29 · Rate limiting de l'auth** : `ThrottlerGuard` sur `AuthController`, `register` 3/min, `login` 5/min, `refresh` et `logout` exclus. Consigné au CHANGELOG (Unreleased).
- **2026-07-30 · `GET /auth/me` supprimé**, `GET /users/me` le remplace. `getMe` lève 401 et non 404 : le mobile ne se déconnecte que sur un 401.
- **2026-07-30 · `GET /users/:username` ne renvoie jamais `email` ni `role`.** Le type mobile `UserProfile` les exclut : la règle est portée par le type.
- **2026-07-30 · Projet en cours** : compteur `sessionsCount` sur `Ascent`, pas de table par séance. `attemptsToAdd` s'additionne côté serveur (`increment`).
- **2026-07-30 · `REPEAT` hors MVP.**
- **2026-07-30 · Tests e2e de l'API reportés.** Conception déjà faite : `docs/notes/api-tests.md`.

Mobile
- **2026-09-29 · Client API (corps vide)** : `get/post/put/patch` lèvent sur un corps vide, `api.getOrNull` est réservé aux vides légitimes, `delete` renvoie `void`.
- **2026-07-30 · Expo SDK 55 + New Architecture : choix délibéré.** Expo Go ne peut pas lancer le projet. Development build reporté : `docs/notes/expo-dev-build.md`.
- **2026-07-30 · `logout()` vide le cache TanStack dans `AuthContext`**, pas dans un écran.
- **2026-07-29 · Explore** : seul le grand titre se replie au scroll. Recherche, Filters et chips restent fixes.
- **2026-07-30 · Pastille de statut sur les cartes Explore : hors MVP.** Conception conservée : `docs/notes/explore.md`.
- **2026-07-30 · Profil** : taux de flash, ascensions récentes, Follow et Edit profile différés. Détail : `docs/notes/profil-backlog.md`.
- **2026-10-08 · Toast de confirmation après un log d'ascension** : aujourd'hui l'écran se met à jour sans aucun retour visuel. À faire sur une branche à part, après l'écran Session.
- **2026-07-30 · Boulder detail** : la note privée est masquée en mode In Project tant qu'aucun écran ne la relit. Design cible et backlog : `docs/notes/boulder-detail.md`.
- **Library sans segment « Liked »** (date inconnue). Le backend n'a aucune notion de favori.

Général
- **2026-10-08 · Fin de session** : mise à jour de ce fichier, commit, push, puis `/clear`. Ni `/compact` ni prompt de reprise : ce fichier est importé à chaque session.
- **2026-10-08 · Pas de SQL écrit à la main** quand Prisma sait l'exprimer : vérifier d'abord ce que la version installée supporte.
- **Version 0.x** tant que le MVP n'est pas terminé (date inconnue).

## Invariants : implémenté ou seulement prévu

| Invariant | État réel |
| --- | --- |
| Une seule session active par utilisateur | **Tenu** par le service (`findFirst`, 409 lisible) et par l'index partiel unique `board_sessions_one_active_per_user` (#54, à fusionner). Rejet vérifié par insertion SQL directe ; deux requêtes HTTP simultanées non testées, faute d'e2e. |
| Ascension rattachée à la session active | **Non implémenté.** `AscentsService.create` fait `dto.sessionId ?? null` et le mobile n'envoie jamais `sessionId`. |
| Fermeture automatique des sessions zombies | **Non implémenté.** Une session jamais terminée bloque tout nouveau Start. |
| Déconnexion seulement sur un 401 | **Non.** Tout échec du refresh (réseau, 5xx, 429) efface le refresh token et déconnecte. Pistes : `docs/notes/mobile-reseau.md`. |
| Timeout sur les `fetch` mobiles | **Absent.** Un hôte injoignable donne un spinner infini. |
| Docker / docker-compose | **Absent.** Prévu pour les tests e2e de l'API. |
| `REPEAT` | Valeur dans l'enum, aucune règle dans `create` : un `POST` avec `REPEAT` sur un bloc jamais envoyé passe. |

## Périmètre

- Modules API existants : `auth`, `users`, `boulders`, `ascents`, `sessions`, `playlists`, `grades`, `admin`.
- Modules API prévus : `boards`, `feed`, `challenges`.
- Écrans mobiles placeholder : Home (échantillon de polices avec de fausses données) et Session.
- Tests : unitaires sur `apps/api` seulement (Prisma mocké), aucun e2e, aucun test mobile. `getActiveSession` n'a pas de test.
- Outillage : collection Bruno dans `apps/api/bruno/`. Comptes de test dans `prisma/seed.ts` (`kilter_admin`) et `prisma/seed-dev.ts` (`test_user_N`).
- Pièges Jest du monorepo et conventions de spec : `docs/notes/api-tests.md`.

## Questions ouvertes

- Sessions zombies : cron ou fermeture paresseuse (à la lecture, au Start) ? Quelle valeur de `endedAt` ?
- Types mobiles de session : `title` nullable (comme la base) et dates en `string` (comme `lib/ascents/types.ts`). Proposé par l'agent le 2026-10-08, pas encore confirmé par Seb.
- `login` renvoie 200 et `refresh` 201 : l'agent recommande d'aligner `refresh` sur 200 dans une branche `fix/`. À décider.
- Vérification manuelle demandée et non rapportée : deux refresh d'affilée dans Bruno. (Le log d'une ascension depuis l'app est validé le 2026-10-08 : `api.post` envoie bien le corps.)
