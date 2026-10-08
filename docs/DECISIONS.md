# Décisions et état courant

Ce fichier est la source de vérité entre deux sessions. Il prime sur `docs/STATUS.md`.
En fin de session, l'agent propose un diff de ce fichier et Seb le valide avant écriture.
Garder le fichier court : une ligne par fait, avec une date pour chaque décision.

Dernière mise à jour : 2026-10-08

## Chantier en cours

- Branche `feature/session-screen`, partie de `develop` le 2026-10-01.
- Objectif : écran Session côté mobile (roadmap STATUS §6, points 3 et 4).
- `apps/mobile/lib/sessions/` n'existe pas encore.
- TODO Seb : préciser où en est le travail et quelle est la prochaine étape.

## Travail non commité

- (vide = rien en suspens. Format : `fichier` : intention, raison de ne pas commiter tout de suite)

## Décisions tranchées (ne pas rouvrir sans raison nouvelle)

- **2026-09-29 · Client API mobile (corps vide).**
  - `apiFetch<T>` renvoie `T | null` quand la réponse est OK mais sans corps (204, ou `GET /sessions/active` sans session active).
  - `api.get/post/put/patch` lèvent une erreur si le résultat est `null`.
  - `api.getOrNull` est réservé aux cas où `null` est légitime.
  - Commité : `feat(mobile): distinguer réponse vide légitime et anomalie dans le client API`.
- **2026-09-29 · `GET /sessions/active`** renvoie la board ainsi que les ascensions, avec cote, angle et essais. Commité.
- **2026-09-29 · Rate limiting de l'auth corrigé.**
  - `ThrottlerGuard` est posé sur `AuthController`.
  - `register` est limité à 3 requêtes/min, `login` à 5/min.
  - `refresh` et `logout` en sont exclus.
  - La correction est consignée dans le CHANGELOG (section Unreleased).
- **Library sans segment « Liked ».** Le backend n'a aucune notion de favori. Choix assumé.
- **Version 0.x** tant que le MVP n'est pas terminé.

## Invariants : implémenté ou seulement prévu

| Invariant | État réel |
| --- | --- |
| Une seule session active par utilisateur | Tenu **uniquement par le service** (`findFirst` avant `create`). L'index partiel unique est **absent** des migrations, ce qui laisse une fenêtre TOCTOU (double tap, retry réseau). Prévu : migration SQL manuelle. |
| Ascension rattachée à la session active | **Non implémenté.** `sessionId` n'est rattaché que s'il est envoyé explicitement, et le mobile ne l'envoie jamais. Voir les questions ouvertes. |
| Docker / docker-compose | **Absent.** Prévu pour les tests e2e de l'API. |
| `REPEAT` | La valeur existe dans l'enum, mais aucune règle ne s'y applique. Hors MVP. |

## Périmètre

- Modules API existants : `auth`, `users`, `boulders`, `ascents`, `sessions`, `playlists`, `grades`, `admin`.
- Modules API prévus : `boards`, `feed`, `challenges`.
- Écrans mobiles placeholder : Home (échantillon de polices avec de fausses données) et Session.

## Questions ouvertes

- Rattacher les ascensions à la session de façon implicite (le serveur résout la session active) ou explicite (le mobile envoie `sessionId`) ? Le choix change le contrat de `POST /ascents`. À trancher avant l'écran Session.
