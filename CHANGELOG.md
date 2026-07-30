# Changelog

Toutes les modifications notables de ce projet sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versions selon [SemVer](https://semver.org/lang/fr/).

## [0.1.0] — 2026-07-30

Première release depuis `main`, qui accusait 45 commits de retard. Elle couvre
le backend complet et le socle mobile : découverte, détail d'un bloc,
enregistrement d'ascensions, cycle de vie d'un projet, profil et bibliothèque.

Version **0.x** volontairement : le MVP n'est pas terminé (voir *Connu et
assumé*), et annoncer un 1.0.0 laisserait croire à une API stable.

### Backend — NestJS / Prisma / PostgreSQL

**Modules** — `auth`, `users`, `boulders`, `ascents`, `sessions`, `playlists`,
`grades`, `admin`.

**Authentification** — JWT + refresh tokens en base, rotation à chaque
rafraîchissement, `bcrypt`, throttling sur `register` et `login`. Les messages
d'erreur ne distinguent jamais « compte inconnu » de « mot de passe faux », pour
ne pas permettre d'énumérer les comptes.

**Règles métier appliquées côté serveur** — un client ne fait que les refléter :

- un flash n'est possible qu'au premier contact avec le bloc, et vaut
  exactement 1 essai (0 est refusé comme 5) ;
- un seul projet actif par bloc ; tant qu'il est ouvert, aucune nouvelle
  ascension n'est acceptée — il se termine par `PATCH` ;
- aucune transition ne mène à `FLASH` : c'est un fait de création, pas un état
  qu'on atteint ;
- grade ressenti obligatoire au premier envoi et pour clore un projet ;
- commentaire public réservé au premier envoi, unique par (utilisateur, bloc) ;
- une seule session active par utilisateur (`endedAt IS NULL`) ;
- seules les ascensions au statut `PROJECT` peuvent être supprimées.

**Tests** — 140 tests unitaires couvrant tous les services (Prisma mocké).

### Mobile — Expo SDK 55 / Expo Router / React Native 0.83

- **Auth** — inscription, connexion par email *ou* pseudo, rafraîchissement
  transparent des jetons, bootstrap au démarrage.
- **Explore** — liste paginée à défilement infini, recherche, filtres
  (cotation, angle, tags, créateur), chips de filtres actifs, titre repliable.
- **Détail d'un bloc** — visualisation des prises sur la board, statistiques,
  formulaire d'enregistrement, commentaires de la communauté.
- **Cycle de vie d'un projet** — sous-onglets *In Project* / *Sent* :
  enregistrer une séance de plus ou clore le projet.
- **Library** — projets en cours et playlists.
- **Profile** — profil, statistiques, déconnexion.
- **Navigation** — cinq onglets (Home, Explore, Session, Library, Profile),
  Session au centre.

### Corrections notables

- **Déconnexion toutes les 15 minutes** : le retry qui suivait un
  rafraîchissement repartait avec le jeton expiré, car le ref était alimenté par
  un effet — donc en retard d'un rendu.
- **Refresh token effacé aussitôt qu'émis** : la rotation était appliquée deux
  fois, la seconde supprimant le jeton fraîchement créé.
- **Fuite de données sur le profil public** : `GET /users/:username` renvoyait
  l'email et le rôle de n'importe quel compte à partir de son seul pseudo.
- **`RolesGuard`** rendait un 500 au lieu d'un refus lorsqu'aucun utilisateur
  n'était attaché à la requête.

### Connu et assumé — hors périmètre de cette version

- Pas de favoris sur les blocs (aucun modèle backend).
- `REPEAT` existe dans l'enum mais n'est ni exposé ni protégé.
- Pas d'écran de détail de playlist, ni de session, ni d'édition de profil.
- Pas de taux de flash ni d'ascensions récentes (aucun agrégat exposé).
- Pas de tests e2e : l'infrastructure demande une base de test dédiée.
- `GET /users/me/projects` et `GET /playlists/me` ne sont pas paginés.
