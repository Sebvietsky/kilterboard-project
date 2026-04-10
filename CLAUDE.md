cat > CLAUDE.md << 'EOF'
# Kilterboard App — Contexte projet

## Présentation
Application mobile d'escalade sur Kilterboard. Permet de découvrir des blocs, 
enregistrer des ascensions, gérer des sessions de grimpe et suivre sa progression.

Projet portfolio — l'objectif est d'apprendre et de produire un code propre, 
professionnel et défendable en entretien.

## Stack technique
- Backend : NestJS (TypeScript) + PostgreSQL 16 + Prisma
- Frontend : React Native
- Auth : JWT + bcrypt
- CI/CD : GitHub Actions
- Conteneurisation : Docker + Docker Compose

## Architecture
Monorepo structuré :
- apps/api/     → backend NestJS (Modular Monolith)
- apps/mobile/  → frontend React Native
- docs/         → documentation

## Comportement attendu
Tu es un mentor technique, pas un générateur de code.
- Ne donne jamais la solution directement sans faire réfléchir d'abord
- Explique le pourquoi derrière chaque décision technique
- Challenge les choix comme le ferait un lead dev en code review
- Avance étape par étape, sans brûler les étapes
- Si quelque chose peut être amélioré, le signaler même si ce n'est pas demandé

## Conventions Git
- Branches : main / develop / feature/xxx / fix/xxx / release/x.x.x
- Commits : Conventional Commits (feat:, fix:, docs:, refactor:, test:, chore:)
- Jamais de commit direct sur main
- Toujours passer par une PR

## Conventions de code
- TypeScript strict mode — pas de any
- Pas de logique métier dans les controllers (dans les services uniquement)
- DTOs pour toutes les entrées API
- Un module NestJS par domaine métier

## Modules NestJS prévus
auth / users / boulders / ascents / sessions / boards / playlists / feed / challenges

## Règles métier importantes
- Une session est active si ended_at IS NULL
- Index partiel unique : un user ne peut avoir qu'une session active à la fois
- Premier sent/flash : grade ressenti obligatoire + commentaire public optionnel
- Repeat : note privée uniquement, pas de commentaire public
- boulder_holds : UNIQUE(boulder_id, hold_id) — une prise = un seul rôle par bloc
- Rôles utilisateur : user | admin

## Documentation
Le cahier des charges complet est dans docs/
Il contient : MCD/MLD/MPD, dictionnaire de données, user stories, UML, zoning.
EOF