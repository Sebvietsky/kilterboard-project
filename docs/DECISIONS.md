# Décisions et état courant

Ce fichier est la source de vérité entre deux sessions. Il prime sur `docs/STATUS.md`.
En fin de session, l'agent propose un diff de ce fichier et Seb le valide avant écriture.
Garder le fichier court : une ligne par fait, avec une date pour chaque décision.
Le détail de conception vit dans `docs/notes/` (non importé) : lire la note du sujet avant d'y travailler.

Dernière mise à jour : 2026-10-08

## Chantier en cours

- Branche `feature/session-screen`, créée depuis `develop` (`3b555a0`) le 2026-10-01.
- Objectif : écran Session mobile, cycle de vie seul (start / end, chrono, blocs faits). Sans BLE.
- Déjà dans `develop` (#52) : `GET /sessions/active` enrichi et `api.getOrNull` dans le client mobile.
- Côté mobile, rien n'est commencé : `apps/mobile/lib/sessions/` n'existe pas et `app/(tabs)/session.tsx` est un placeholder.
- Plan proposé (non figé) — prochaine étape : `lib/sessions/types.ts`, écrit par Seb à partir des JSON réels. Deux types : `Session` (réponse de start / end) et `ActiveSession extends Session` (+ `board`, `ascents`). Dates en `string`.
- Plan proposé (non figé) — ensuite : `sessionKeys`, `useActiveSession` (via `api.getOrNull`), `useStartSession`, `useEndSession`, invalidations croisées avec `ascentKeys`.
- Plan proposé (non figé) — puis l'écran : loading / erreur / `null` → Start / session en cours (chrono dérivé de `startedAt`, liste des blocs, End).
- Après l'écran, sur une branche séparée : rattachement implicite de `sessionId`, puis index partiel unique. Voir `docs/notes/sessions-backend.md`.

## Travail non commité

- (vide = rien en suspens. Format : `fichier` : intention, raison de ne pas commiter tout de suite)

## Décisions tranchées (ne pas rouvrir sans raison nouvelle)

Sessions
- **2026-07-31 · Rattachement des ascensions à la session : implicite.** Si `sessionId` est absent, le serveur résout la session active. `sessionId: null` explicite = hors session. Pas encore implémenté.
- **2026-07-31 · Index partiel unique** par migration SQL manuelle. Le `findFirst` de `startSession` reste : il donne le 409 lisible, l'index garantit.
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
- **2026-07-30 · Boulder detail** : la note privée est masquée en mode In Project tant qu'aucun écran ne la relit. Design cible et backlog : `docs/notes/boulder-detail.md`.
- **Library sans segment « Liked »** (date inconnue). Le backend n'a aucune notion de favori.

Général
- **Version 0.x** tant que le MVP n'est pas terminé (date inconnue).

## Invariants : implémenté ou seulement prévu

| Invariant | État réel |
| --- | --- |
| Une seule session active par utilisateur | Tenu **uniquement par le service** (`findFirst` avant `create`). Index partiel unique **absent** des migrations : fenêtre TOCTOU (double tap, retry réseau). |
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
- `title` est `String?` dans `BoardSession` alors que `startSession` le remplit toujours : nullable ou non dans le type mobile ?
- `login` renvoie 200 et `refresh` 201 : à aligner ?
- Vérifications manuelles demandées et non rapportées : logger une ascension depuis l'app (preuve que `post` envoie le corps depuis le refactor du client), et deux refresh d'affilée dans Bruno.
