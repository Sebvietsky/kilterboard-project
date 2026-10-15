# Décisions et état courant

Ce fichier est la source de vérité entre deux sessions. Il prime sur `docs/STATUS.md`.
En fin de session, l'agent propose un diff de ce fichier et Seb le valide avant écriture.
Garder le fichier court : une ligne par fait, avec une date pour chaque décision.
Le détail de conception vit dans `docs/notes/` (non importé) : lire la note du sujet avant d'y travailler.

Dernière mise à jour : 2026-10-15

## Chantier en cours

**Prochaine action :** ouvrir `feature/angle-collections` depuis `develop` : inclinaison sur les favoris et les entrées de playlist.

- Fusionnés le 2026-10-15 : favoris (#65), inclinaison étape 1 (#66). Le 2026-10-12 : refresh token par appareil (#63), historique des sessions (#59), playlists (#61, #62).
- Ensuite, dans l'ordre : `feature/angle-collections`, puis inclinaison étape 2 (cotation communautaire) et étape 3 (Explore). Conception : `docs/notes/boulder-angle.md`, à lire avant d'y toucher.
- Restent à faire sans branche prévue : historique des ascensions dans le profil (`GET /ascents/me` existe) ; encart de connexion à une board sur l'onglet Session, quand le BLE sera dégelé.
- Après un changement de branche pendant que l'app tourne : recharger l'app complètement (`r` dans Metro) avant de tester.
- Après une migration : `pnpm --filter api db:generate`. Prisma 7 ne régénère plus le client dans `migrate dev`.

## Travail non commité

- `apps/api/bruno/environments/Local.bru` : variables de test que Seb change au fil de l'eau. Ne jamais commiter.

## Décisions tranchées (ne pas rouvrir sans raison nouvelle)

Sessions
- **2026-07-31 · Rattachement des ascensions à la session : implicite.** Si `sessionId` est absent, le serveur résout la session active. `sessionId: null` explicite = hors session. Fait le 2026-10-09 (#56) ; la résolution vit dans `SessionsService.resolveSessionId`.
- **2026-10-09 · Journal de session : table `session_entries`**, une ligne par passage sur un bloc (statut et essais du passage). Remplace `ascents.session_id` : un bloc peut figurer dans plusieurs sessions, et plusieurs fois dans la même. Complète la décision du 2026-07-30 sans l'annuler : le compteur `sessionsCount` reste, la table s'ajoute parce que le compte rendu d'une session demande l'historique par séance.
- **2026-10-09 · Une séance sur un projet ou sa complétion (`PATCH /ascents/:id`) écrit un passage.** Une simple modification de note n'en écrit pas.
- **2026-10-08 · Index partiel unique fait** (#54), avant l'écran et non après. Déclaré dans `schema.prisma` par `@@unique(..., where:)` avec la preview feature `partialIndexes` (Prisma 7.8), pas en SQL manuel. Le `findFirst` de `startSession` reste : il donne le 409 lisible, l'index garantit.
- **2026-10-09 · Sessions oubliées : fermeture paresseuse après 2 h sans bloc loggé** (au Start, à la lecture, au log), pas de cron. `endedAt` reçoit la date de la dernière activité. Remplace « environ 6 h » du 2026-09-29. Un End tardif est daté de la même façon.
- **2026-10-09 · `GET /sessions/active`** renvoie la board et `entries` (les passages, avec le bloc, sa cote et son angle). Pas de rating ni de grade ressenti : le critère est ce que l'écran affiche.
- **2026-10-12 · `GET /sessions/:id`** : même forme que la session active. 403 sur la session d'un autre, comme `endSession`.
- **2026-10-09 · L'historique mobile masque les sessions vides ou en cours.** Filtre côté mobile (`select` de `useMySessions`), la route renvoie tout.
- **2026-07-31 · BLE gelé**, hors périmètre de l'écran Session. Lib, architecture et source des données déjà choisies : `docs/notes/ble-reprise.md`.

API
- **2026-09-29 · Rate limiting de l'auth** : `ThrottlerGuard` sur `AuthController`, `register` 3/min, `login` 5/min, `refresh` et `logout` exclus. Consigné au CHANGELOG (Unreleased).
- **2026-07-30 · `GET /auth/me` supprimé**, `GET /users/me` le remplace. `getMe` lève 401 et non 404 : le mobile ne se déconnecte que sur un 401.
- **2026-07-30 · `GET /users/:username` ne renvoie jamais `email` ni `role`.** Le type mobile `UserProfile` les exclut : la règle est portée par le type.
- **2026-07-30 · Projet en cours** : compteur `sessionsCount` sur `Ascent`, pas de table par séance. `attemptsToAdd` s'additionne côté serveur (`increment`).
- **2026-07-30 · `REPEAT` hors MVP.**
- **2026-10-12 · Un refresh token par appareil** (#63) : `generateTokens` ne supprime que les tokens expirés de l'utilisateur. Le token présenté au refresh reste valide 60 s (`REFRESH_REUSE_GRACE_MS`) pour couvrir une réponse perdue. `POST /auth/logout` ne révoque que le token envoyé.
- **2026-10-12 · Playlists** : `GET /playlists/me?boulderId=` renvoie `containsBoulder` par playlist (#61). `GET /playlists/:id` trie ses blocs par position, puis ajout le plus récent (#62).
- **2026-10-12 · Limite de 3 tags par bloc** : à poser dans la validation le jour où la création d'un bloc existe. Aujourd'hui aucune route ne crée de bloc ni n'attribue de tag.
- **2026-10-14 · Favoris : `PUT` et `DELETE /boulders/:id/like`, idempotents** (#65) : `createMany` + `skipDuplicates`, et `deleteMany`. Un renvoi après une réponse perdue réussit sans rien changer. `PUT` renvoie `{ liked }`, car le client `put` lève sur un corps vide.
- **2026-10-14 · `GET /boulders/:id/like` séparé** de `GET /boulders/:id`, qui reste public : pas de guard JWT optionnel, et un tap n'invalide que l'état du cœur.
- **2026-07-30 · Tests e2e de l'API reportés.** Conception déjà faite : `docs/notes/api-tests.md`.

Mobile
- **2026-09-29 · Client API (corps vide)** : `get/post/put/patch` lèvent sur un corps vide, `api.getOrNull` est réservé aux vides légitimes, `delete` renvoie `void`.
- **2026-07-30 · Expo SDK 55 + New Architecture : choix délibéré.** Expo Go ne peut pas lancer le projet. Development build reporté : `docs/notes/expo-dev-build.md`.
- **2026-07-30 · `logout()` vide le cache TanStack dans `AuthContext`**, pas dans un écran.
- **2026-07-29 · Explore** : seul le grand titre se replie au scroll. Recherche, Filters et chips restent fixes.
- **2026-07-30 · Pastille de statut sur les cartes Explore : hors MVP.** Conception conservée : `docs/notes/explore.md`.
- **2026-07-30 · Profil** : taux de flash, ascensions récentes, Follow et Edit profile différés. Détail : `docs/notes/profil-backlog.md`.
- **2026-10-08 · Toast de confirmation après un log d'ascension.** Fait le 2026-10-09 (#57) : store zustand, `ToastHost` à la racine, et bouton de log figé sur « Logged » le temps du toast.
- **2026-10-09 · Pastille de session dans le header** : contour neutre au repos (ne pas avoir de session n'est pas une alerte), point gold et chrono quand elle tourne. Absente de l'onglet Session.
- **2026-10-12 · Écrans de détail (bloc, session) : barre native conservée**, avec la pastille de session. Utilise `unstable_headerRightItems` (API instable de React Navigation) : à revoir à chaque montée de version.
- **2026-10-09 · `QueryClient` dans un state de `RootLayout`**, pas en constante de module : il survit au rechargement à chaud.
- **2026-10-09 · Start et End invalident dans `onSettled`** : après un 409, l'écran relit l'état au lieu de rester sur un bouton qui échoue.
- **2026-07-30 · Boulder detail** : la note privée est masquée en mode In Project tant qu'aucun écran ne la relit. Design cible et backlog : `docs/notes/boulder-detail.md`.
- **2026-10-12 · Favoris : table dédiée, pas une playlist spéciale.** Fait le 2026-10-14 (#65) : cœur en mise à jour optimiste, grisé tant que l'état est inconnu ; segment « Liked » au centre de Library. Visibilité dans le profil : pas encore faite.
- **2026-10-14 · « Liked » et non « Favorites »** : la liste reprend le verbe de l'action (cœur, Like / Unlike).
- **2026-10-12 · « Add to playlist »** (#61) : bouton sous le bouton de log, feuille native où un tap bascule l'appartenance du bloc. Pas de toast dans une feuille : il serait rendu dessous.
- **2026-10-12 · Détail d'une playlist** (#62) : retrait d'un bloc, suppression et édition (nom, description, visibilité) réservés au propriétaire.
- **2026-10-12 · Réordonner les blocs d'une playlist : reporté.** Glisser-déposer et non flèches ; demande des bibliothèques natives et un development build.
- **2026-10-12 · Une playlist n'est pas verrouillée à une inclinaison** : on y mélange librement les inclinaisons. Complété le 2026-10-15 : chaque entrée portera la sienne.
- **2026-10-12 · Bouton « ampoule » pour allumer un bloc sur la Kilter** : bouton rond flottant sur l'image de la board. À faire avec le BLE, pas avant : un bouton sans effet se lit comme une panne.
- **2026-10-12 · Le refresh a trois issues** (`refreshed`, `rejected`, `unavailable`) ; seul `rejected` déconnecte (#63).

Inclinaison (décidé le 2026-10-12, étape 1 faite le 2026-10-15 (#66) — détail : `docs/notes/boulder-angle.md`)
- **2026-10-15 · Principe : le même bloc à une autre inclinaison est un autre bloc.** Le créateur fixe l'inclinaison par défaut du bloc (`boulders.angle_id`) ; chaque action de l'utilisateur (ascension, like, entrée de playlist) enregistre la sienne.
- **Deux envois à deux inclinaisons sont deux réussites distinctes.** Flash, projet ouvert et grade ressenti au premier envoi passent « par bloc et par inclinaison ». L'ascension enregistre son inclinaison.
- **Sélecteur d'inclinaison dans l'en-tête du détail d'un bloc**, local à l'écran : il ne modifie jamais le filtre d'Explore. **À l'ouverture : l'inclinaison du lien** (`boulderHref` : la carte d'Explore, l'ascension d'un projet ou d'un passage), sinon celle du créateur. Remplace « dernière inclinaison choisie » (2026-10-15).
- **2026-10-15 · `angleDegrees` obligatoire sur `POST /ascents`, sans défaut serveur** : seul le client connaît l'inclinaison réelle, et un défaut ferait d'un oubli une donnée fausse et silencieuse.
- **2026-10-15 · Commentaire public : un par utilisateur, par bloc et par inclinaison.** L'écran n'affiche que ceux de l'inclinaison choisie ; la clé de liste est l'id du commentaire.
- **2026-10-15 · Favoris et entrées de playlist porteront leur inclinaison.** Un bloc liké à 50° se rouvre à 50°. Pas encore implémenté : aujourd'hui ils ouvrent le bloc à l'inclinaison du créateur.
- **Cotation par inclinaison : la communauté remplace le créateur à partir de 5 votes**, par la médiane des grades ressentis. Sans cotation de départ à cette inclinaison : « estimée » sous le seuil. Un vote par personne, par bloc et par inclinaison.
- **Cotation effective stockée dans une table `boulder_angle_grades`** (bloc, inclinaison, cotation, votes) : une ligne à la création pour l'inclinaison du créateur, les autres au premier vote. Elle sert le filtre et le tri d'Explore ; `boulders.grade_id` et `angle_id` restent la référence du créateur.
- **Affichage** : la cotation effective seule ; celle du créateur en petit, seulement si elle diffère. Message neutre indiquant que le grade ressenti compte dans la cotation.

Général
- **2026-10-08 · Fin de session** : mise à jour de ce fichier, commit, push, puis `/clear`. Ni `/compact` ni prompt de reprise : ce fichier est importé à chaque session.
- **2026-10-08 · Pas de SQL écrit à la main** quand Prisma sait l'exprimer : vérifier d'abord ce que la version installée supporte.
- **2026-10-15 · SQL à la main autorisé pour une migration de données** (remplissage avant un `NOT NULL`), en complétant le fichier généré par `migrate dev --create-only`.
- **2026-10-12 · L'agent ne se connecte jamais avec un compte que Seb utilise sur son téléphone.** Vérifications HTTP avec `test_user_15` uniquement. (Le 2026-10-09, une connexion de l'agent en `test_user_1` avait déconnecté le téléphone.)
- **Version 0.x** tant que le MVP n'est pas terminé (date inconnue).

## Invariants : implémenté ou seulement prévu

| Invariant | État réel |
| --- | --- |
| Une seule session active par utilisateur | **Tenu** par le service (`findFirst`, 409 lisible) et par l'index partiel unique `board_sessions_one_active_per_user` (#54). Rejet vérifié par insertion SQL directe ; deux requêtes HTTP simultanées non testées, faute d'e2e. |
| Ascension consignée dans la session active | **Tenu** (#56) : `POST` et `PATCH /ascents` écrivent un passage dans `session_entries`. Vérifié en HTTP réel sur l'API locale ; pas d'e2e. |
| `sessionId` explicite : session à soi et ouverte | **Tenu** (#56) : 404, 403 ou 409 sinon. Il n'est en revanche pas soumis à la règle des 2 h. |
| Fermeture automatique des sessions oubliées | **Tenu** (#56), paresseuse : la session reste ouverte en base tant que l'utilisateur ne revient pas. |
| Déconnexion seulement sur un refus du serveur | **Tenu dans le code** (#63) : réseau, 5xx et 429 conservent la session. Le cas « serveur injoignable » n'a pas été vérifié sur téléphone. Détail : `docs/notes/mobile-reseau.md`. |
| Plusieurs appareils connectés sur un même compte | **Tenu** (#63) : un refresh token par appareil. Vérifié en HTTP réel à deux connexions ; pas d'e2e. |
| Like et unlike idempotents | **Tenu** (#65) : double `PUT` → 200, double `DELETE` → 204, vérifié en HTTP réel ; tests unitaires. |
| Règles d'ascension par bloc et par inclinaison | **Tenu** (#66) par le filtre sur l'inclinaison dans `create` : vérifié en HTTP réel (second projet à 45° refusé, projet à 50° accepté) ; pas d'e2e. |
| Timeout sur les `fetch` mobiles | **Absent.** Un hôte injoignable donne un spinner infini. |
| Docker / docker-compose | **Absent.** Prévu pour les tests e2e de l'API. |
| `REPEAT` | Valeur dans l'enum, aucune règle dans `create` : un `POST` avec `REPEAT` sur un bloc jamais envoyé passe. |

## Périmètre

- Modules API existants : `auth`, `users`, `boulders`, `ascents`, `sessions`, `playlists`, `grades`, `admin`.
- Modules API prévus : `boards`, `feed`, `challenges`.
- Écrans mobiles placeholder : Home (échantillon de polices avec de fausses données).
- Tests : unitaires sur `apps/api` seulement (Prisma mocké), aucun e2e, aucun test mobile.
- Outillage : collection Bruno dans `apps/api/bruno/`. Comptes de test dans `prisma/seed.ts` (`kilter_admin`) et `prisma/seed-dev.ts` (`test_user_N`).
- Pièges Jest du monorepo et conventions de spec : `docs/notes/api-tests.md`.

## Questions ouvertes

- Dates en base : celles écrites par Prisma sont décalées de 2 h par rapport à `now()` en SQL (PostgreSQL en `Europe/Paris`). L'API est cohérente avec elle-même ; toute requête SQL à la main qui compare avec `now()` est fausse. Cause et impact à vérifier.
- Explore et inclinaisons (étape 3) : avec un filtre, le bloc apparaît à toute inclinaison cotée (`boulder_angle_grades`). Sans filtre, trois formes : une carte par bloc, une carte par couple (bloc, inclinaison) (plus fidèle au principe du 2026-10-15), ou une carte avec des pastilles d'inclinaison.
- Filtre Explore « jamais fait » : jamais fait **à cette inclinaison**. Sans filtre d'inclinaison, son sens dépend de la question précédente.
- `GET /sessions/me` et `GET /boulders/likes/me` ne sont pas paginés. À trancher ensemble.
- Étape 2 : statistiques du bloc (ascensions, note) et pastilles de cotation des cartes de projet et de session, encore toutes inclinaisons confondues.
- Compte rendu de session : afficher l'inclinaison de chaque passage ? Les liens l'utilisent déjà, l'affichage non.
- La table `angles` n'a pas 65° (seed) alors que la Kilter se règle par pas de 5°. `ANGLES` côté mobile reprend la même liste.
- `login` renvoie 200 et `refresh` 201 : l'agent recommande d'aligner `refresh` sur 200 dans une branche `fix/`. À décider.
- Test manuel à faire sur téléphone : arrêter l'API, attendre 15 min que le token d'accès expire, utiliser l'app (une erreur doit s'afficher, sans retour à l'écran de connexion), relancer l'API. Marche à suivre dans `docs/notes/mobile-reseau.md`.
- Inclinaison, étape 2 : la ligne de `boulder_angle_grades` naît-elle au premier essai (cotation vide) ou au premier vote ? Avantages et inconvénients à comparer avant de coder.
- L'authentification n'a de test automatique que côté service. Le scénario à deux appareils et tout le côté mobile ne sont vérifiés qu'à la main : meilleur candidat pour démarrer les tests e2e.
