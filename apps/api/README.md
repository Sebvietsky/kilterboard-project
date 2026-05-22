# Kilterboard — API

Backend de l'application Kilterboard. API REST construite avec **NestJS** selon une architecture de **Modular Monolith** : chaque domaine métier est encapsulé dans son propre module NestJS, avec une séparation stricte entre controllers, services et DTOs.

---

## Stack technique

- **NestJS 11** + TypeScript strict (no `any`)
- **PostgreSQL 16** + Prisma ORM
- **JWT** (access token) + **bcrypt** pour les mots de passe
- **class-validator** / **class-transformer** pour la validation des DTOs
- **@nestjs/throttler** pour le rate limiting
- **Jest** pour les tests

---

## Prérequis

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9
- [PostgreSQL 16](https://www.postgresql.org/) installé et démarré en local

---

## Installation

### 1. Dépendances

Depuis la **racine du monorepo** :

```bash
pnpm install
```

Ou depuis ce dossier uniquement :

```bash
pnpm install
```

### 2. Variables d'environnement

Copie le fichier d'exemple et renseigne tes valeurs :

```bash
cp .env.example .env
```

| Variable              | Description                                      | Exemple                                              |
|-----------------------|--------------------------------------------------|------------------------------------------------------|
| `DATABASE_URL`        | URL de connexion PostgreSQL                      | `postgresql://user:pass@localhost:5432/kilterboard`  |
| `NODE_ENV`            | Environnement d'exécution                        | `development`                                        |
| `ACCESS_TOKEN_SECRET` | Clé secrète pour signer les JWT                  | Une chaîne longue et aléatoire                       |
| `PORT`                | Port d'écoute du serveur                         | `3000`                                               |
| `ALLOWED_ORIGIN`      | Origine autorisée pour CORS (production)         | `https://votre-app.com`                              |

### 3. Base de données

Crée la base de données PostgreSQL si elle n'existe pas encore :

```bash
psql -U postgres -c "CREATE DATABASE kilterboard;"
```

Lance les migrations Prisma pour initialiser le schéma :

```bash
pnpm db:migrate dev
```

*(Optionnel)* Initialise la base avec des données de test :

```bash
# Données de référence (grades, layouts, holds…)
pnpm db:seed

# Données de développement (utilisateurs, blocs, ascensions…)
pnpm db:seed:dev
```

### 4. Lancer le serveur

```bash
# Mode développement avec hot-reload
pnpm start:dev

# Mode production
pnpm build && pnpm start:prod
```

L'API est disponible sur `http://localhost:3000` (ou le `PORT` défini dans `.env`).

---

## Scripts disponibles

```bash
pnpm start:dev      # Serveur en mode watch (hot-reload)
pnpm start:debug    # Mode debug avec inspector Node.js
pnpm build          # Compilation TypeScript → dist/
pnpm start:prod     # Démarrage depuis le build compilé

pnpm lint           # ESLint avec auto-fix
pnpm lint:ci        # ESLint sans auto-fix (pour la CI)
pnpm type-check     # Vérification TypeScript sans compilation

pnpm test           # Tests unitaires (Jest)
pnpm test:watch     # Tests en mode watch
pnpm test:cov       # Tests avec rapport de couverture
pnpm test:e2e       # Tests end-to-end

pnpm db:migrate     # Lance les migrations Prisma
pnpm db:generate    # Régénère le client Prisma
pnpm db:seed        # Données de référence
pnpm db:seed:dev    # Données de développement
pnpm db:reset       # Réinitialise la base (⚠️ supprime toutes les données)
```

---

## Architecture des modules

```
src/
├── auth/           → Inscription, connexion, stratégie JWT, guards
├── users/          → Profil utilisateur, suivi, progression (XP/level)
├── boulders/       → Création et gestion des blocs
├── ascents/        → Enregistrement des passages
├── sessions/       → Sessions de grimpe actives/terminées
├── playlists/      → Collections de blocs
├── admin/          → Actions réservées au rôle ADMIN
├── common/         → Guards, interceptors, pipes et décorateurs partagés
└── prisma/         → Module Prisma injectable dans toute l'app
```

Chaque module respecte la structure NestJS standard :
`module` → `controller` (routing) → `service` (logique métier) → `dto` (validation entrées).

---

## Règles métier notables

- **Session active** : `ended_at IS NULL`. Un utilisateur ne peut avoir qu'une seule session active à la fois (index partiel unique en base).
- **Premier sent/flash** : le grade ressenti (`felt_grade`) est obligatoire. Un commentaire public est optionnel.
- **Repeat** : seule une note privée est autorisée, pas de commentaire public.
- **Prises d'un bloc** (`boulder_holds`) : contrainte `UNIQUE(boulder_id, hold_id)` — une prise ne peut avoir qu'un seul rôle par bloc.
- **Rôles** : `USER` (défaut) et `ADMIN`. Les routes admin sont protégées par un `RolesGuard`.
