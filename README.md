# Kilterboard App

Application mobile d'escalade dédiée au **Kilterboard** — un mur d'entraînement avec prises rétroéclairées et une bibliothèque de blocs partagée par la communauté. L'app permet de découvrir des blocs, enregistrer ses ascensions, gérer ses sessions de grimpe et suivre sa progression.

**Projet portfolio** — construit pour apprendre NestJS en situation réelle, avec des contraintes métier non triviales et le développement d'une application mobile complète.

---

## Objectifs d'apprentissage

- Concevoir une API REST avec **NestJS** (architecture modulaire, guards, pipes, interceptors)
- Modéliser un domaine métier complexe avec **Prisma** et PostgreSQL
- Gérer l'authentification **JWT** de bout en bout (access token, guards, rôles)
- Développer une app mobile avec **React Native + Expo**
- Mettre en place une CI/CD avec **GitHub Actions** dans un monorepo

---

## Architecture

Monorepo géré avec **pnpm workspaces** :

```
kilterboard-project/
├── apps/
│   ├── api/        → Backend NestJS (Modular Monolith)
│   └── mobile/     → Frontend React Native (Expo)
├── docs/           → Cahier des charges, MCD/MLD, User Stories, UML
├── pnpm-workspace.yaml
└── package.json
```

---

## Stack technique

| Couche       | Technologie                        |
|--------------|------------------------------------|
| Backend      | NestJS 11 · TypeScript strict      |
| Base de données | PostgreSQL 16 · Prisma ORM      |
| Auth         | JWT · bcrypt                       |
| Mobile       | React Native · Expo                |
| CI/CD        | GitHub Actions                     |
| Monorepo     | pnpm workspaces                    |

---

## Prérequis

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9 — `npm install -g pnpm`
- [PostgreSQL](https://www.postgresql.org/) 16 installé et démarré en local
- [Expo CLI](https://docs.expo.dev/get-started/installation/) pour le mobile

---

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/Sebvietsky/kilterboard-project.git
cd kilterboard-project

# 2. Installer toutes les dépendances (API + mobile)
pnpm install
```

Consulte ensuite le README de chaque application pour la configuration spécifique :

- [`apps/api/README.md`](./apps/api/README.md) — backend NestJS
- `apps/mobile/README.md` — application Expo *(à venir)*

---

## Modules métier (backend)

| Module       | Statut     | Description                                      |
|--------------|------------|--------------------------------------------------|
| `auth`       | ✅ MVP      | Inscription, connexion, JWT                      |
| `users`      | ✅ MVP      | Profil, suivi, système de progression (XP/level) |
| `boulders`   | ✅ MVP      | Création et consultation de blocs                |
| `ascents`    | ✅ MVP      | Enregistrement des passages (sent / flash / repeat) |
| `sessions`   | ✅ MVP      | Sessions de grimpe avec contrainte unicité active |
| `playlists`  | ✅ MVP      | Collections de blocs                             |
| `admin`      | ✅ MVP      | Actions réservées aux administrateurs            |
| `boards`     | 🔜 Prévu   | Gestion des layouts de mur                      |
| `feed`       | 🔜 Prévu   | Fil d'activité social                            |
| `challenges` | 🔜 Prévu   | Défis entre utilisateurs                         |

---

## Documentation

Le dossier `docs/` contient le cahier des charges complet du projet :
MCD/MLD/MPD, dictionnaire de données, user stories, diagrammes UML et zoning.

---

## Conventions

- **Branches** : `main` / `develop` / `feature/xxx` / `fix/xxx` / `release/x.x.x`
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Aucun commit direct sur `main` — toujours via Pull Request
