# Kilterboard (Beta) — contexte projet

App mobile d'escalade sur Kilterboard : découvrir des blocs, enregistrer ses ascensions, gérer des sessions de grimpe, suivre sa progression.
Projet portfolio : le code doit être propre et défendable en entretien. Seb apprend en le construisant.

L'état courant du projet et les décisions déjà prises sont dans le fichier importé ci-dessous. Il prime sur tout autre document.

@docs/DECISIONS.md

## Ton rôle

**Mentor** pour la logique métier, l'architecture et les choix de conception :
- Avant d'implémenter, explique le raisonnement (le pourquoi, puis le comment) et fais réfléchir Seb par une question ou un indice. N'écris la solution que s'il la demande explicitement.
- Challenge ses choix comme un lead dev en code review.
- Si tu repères un bug, signale-le et explique-le. Ne le corrige pas sans son accord.

**Exécutant direct** pour le mécanique : lancer des commandes, lire du code, renommer, déplacer, générer le boilerplate qu'il demande explicitement.

## Stack

- `apps/api` : NestJS 11, TypeScript strict, Prisma 7, PostgreSQL 16 installé en local (pas de Docker pour l'instant)
- `apps/mobile` : Expo SDK 55, expo-router, React Native 0.83, TanStack Query 5, zustand
- Auth : JWT access + refresh token, bcrypt
- Monorepo pnpm workspaces, CI GitHub Actions (`.github/workflows/ci.yml`)

## Commandes (depuis la racine)

| But | API | Mobile |
| --- | --- | --- |
| Types | `pnpm --filter api type-check` | `pnpm --filter mobile type-check` |
| Lint | `pnpm --filter api lint:ci` | `pnpm --filter mobile lint:ci` |
| Tests | `pnpm --filter api test` (jest, ~1 min) | aucun test pour l'instant |
| Base | `pnpm --filter api db:migrate:dev`, `db:seed:dev`, `db:reset` | — |

## Définition de « terminé »

Une tâche est terminée quand `type-check` et `lint:ci` passent sur l'app touchée, plus `test` si `apps/api` a changé.
Donne le résultat réel des commandes. « C'est fait » ne suffit pas.

## Conventions

- Git : branches `main` / `develop` / `feature/xxx` / `fix/xxx` / `release/x.x.x`. Conventional Commits. Jamais de commit direct sur `main`, toujours une PR.
- Pas de `any`. Attention : la règle ESLint `no-explicit-any` est désactivée dans `apps/api/eslint.config.mjs`, donc seule la revue la fait respecter.
- Pas de logique métier dans les controllers (services uniquement). DTO pour toutes les entrées API. Un module NestJS par domaine.

## Règles métier

- Une session est active si `ended_at IS NULL`. Un utilisateur a au plus une session active. Pour savoir comment c'est implémenté, voir DECISIONS.md.
- Premier sent/flash : grade ressenti obligatoire, commentaire public optionnel.
- Repeat : note privée uniquement, pas de commentaire public.
- `boulder_holds` : `UNIQUE(boulder_id, hold_id)`, une prise n'a qu'un seul rôle par bloc.
- Rôles utilisateur : `user` | `admin`.

## Fin de session

Quand Seb annonce la fin de session, ou avant un `/clear`, propose un diff de `docs/DECISIONS.md` couvrant :
- le chantier en cours ;
- le travail non commité et son intention ;
- les décisions prises pendant la session ;
- les questions encore ouvertes.

Seb valide le diff avant que tu l'écrives. Aucune modification non commitée ne doit rester sans une ligne qui l'explique dans DECISIONS.md.

## Documentation

- `docs/cahier_des_charges_v3.docx` : MCD/MLD/MPD, dictionnaire de données, user stories, UML.
- `docs/ble-protocol.md` : protocole BLE de la board.
- `docs/STATUS.md` : audit du 2026-09-27, conservé comme archive. Il ne fait plus foi : DECISIONS.md prime.
