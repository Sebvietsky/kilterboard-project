# Décisions et état courant

Ce fichier est la source de vérité entre deux sessions. Il prime sur `docs/STATUS.md`.
En fin de session, l'agent propose un diff de ce fichier et Seb le valide avant écriture.
Garder le fichier court : une ligne par fait, avec une date pour chaque décision.
Le détail de conception vit dans `docs/notes/` (non importé) : lire la note du sujet avant d'y travailler.

Dernière mise à jour : 2026-10-24

## Chantier en cours

**Prochaine action :** fusionner #86 (vraie connexion BLE) si la CI passe. Puis migration du schéma des prises (choix B, Seb écrit le schéma) et import du catalogue pour la taille 10. L'app installée expire vers le 2026-10-27 : recompiler avant (`docs/notes/expo-dev-build.md`).

- Fusionnés du 2026-10-21 au 2026-10-23 : décisions du 2026-10-20 (#79), timeout et écran hors ligne (#80), inclinaison des passages (#81), historique des ascensions (#82), échelle de cotation (#83), curseur des filtres (#84), essai BLE en salle (#85). Ouverte : #86, vraie connexion BLE. Le 2026-10-20 : development build iOS et Expo SDK 58 (#77), décisions du 2026-10-19 (#78). Le 2026-10-15 : cotation communautaire (#70), protocole et audit des tests (#72), correctifs B1, B2, B3, B5, B7 (#73, arrivés dans `develop` avec #72), suite de l'audit (#74), favoris (#65), inclinaison étape 1 (#66), inclinaison des favoris et des playlists (#68), création de playlist depuis Library (#69). Le 2026-10-12 : refresh token par appareil (#63), historique des sessions (#59), playlists (#61, #62).
- Chantier BLE : essai en salle fait (#85, `docs/notes/ble-essai-salle.md`), vraie connexion faite (#86). Reste, dans l'ordre : migration du schéma des prises (choix B ci-dessous) et import du catalogue (taille 10), réécriture de `seed.ts`, bouton ampoule, création de bloc, puis encart de signalement de bug.
- Audit des tests du 2026-10-15 : 10 écarts (B1 à B10), tous corrigés (#73, #74). Matrice règle → tests : `docs/notes/api-tests-matrice.md`, à tenir à jour dans chaque PR qui touche une règle.
- Base locale remise à zéro le 2026-10-21 pour la table des cotations (#83), puis reseedée, vérifiée en lecture seule : 24 cotations, votes 86/86.
- Mis de côté le temps du BLE (2026-10-17) : étape 3 (Explore, conception : `docs/notes/boulder-angle.md`), pagination, stats du bloc, `refresh` en 200, « déconnecter tous les appareils », e2e, série sur le détail du profil.
- Lancer l'app : `pnpm --filter api start:dev`, `pnpm --filter mobile start` (`--clear` après un changement de dépendances ou de `.env`), puis ouvrir KilterBoard sur l'iPhone. Sans board : `EXPO_PUBLIC_BOARD_SIMULATED=1` dans `apps/mobile/.env`. En salle : partage de connexion de l'iPhone, IP du Mac dans `.env`, à remettre à la maison. Mode développeur activé en permanence. Signature gratuite : l'app expire au bout de 7 jours, recompiler (`docs/notes/expo-dev-build.md`).
- Après un changement des règles de cotation : `pnpm --filter api db:recompute-grades`.
- Après un changement de branche pendant que l'app tourne : recharger l'app complètement (`r` dans Metro) avant de tester.
- Après une migration ou un changement de branche : `pnpm --filter api db:generate`. Prisma 7 ne régénère plus le client dans `migrate dev`. (Le 2026-10-15, un client généré sur une ancienne branche a donné 28 erreurs `tsc` après retour sur `feature/community-grade`.)
- `db:reset` toujours depuis une branche qui a toutes les migrations : lancé depuis une branche ancienne, il crée une base sans `boulder_angles`. Prisma 7 ne lance plus le seed au reset : enchaîner `db:seed` puis `db:seed:dev`. Lancé par l'agent, Prisma exige le message d'accord explicite de Seb.

## Travail non commité

- `apps/api/bruno/environments/Local.bru` : variables de test que Seb change au fil de l'eau. Ne jamais commiter.
- Catalogue matériel Kilter téléchargé dans `/tmp/kilter-catalog.uTof/` : hors dépôt, temporaire, se retélécharge par le manifeste.

## Décisions tranchées (ne pas rouvrir sans raison nouvelle)

Sessions
- **2026-07-31 · Rattachement des ascensions à la session : implicite.** Si `sessionId` est absent, le serveur résout la session active. `sessionId: null` explicite = hors session. Fait le 2026-10-09 (#56) ; la résolution vit dans `SessionsService.resolveSessionId`.
- **2026-10-09 · Journal de session : table `session_entries`**, une ligne par passage sur un bloc (statut et essais du passage). Remplace `ascents.session_id` : un bloc peut figurer dans plusieurs sessions, et plusieurs fois dans la même. Complète la décision du 2026-07-30 sans l'annuler : le compteur `sessionsCount` reste, la table s'ajoute parce que le compte rendu d'une session demande l'historique par séance.
- **2026-10-09 · Une séance sur un projet ou sa complétion (`PATCH /ascents/:id`) écrit un passage.** Depuis le 2026-10-15, un `PATCH` ne porte plus que l'un ou l'autre : la note ne se modifie plus après coup (B10).
- **2026-10-08 · Index partiel unique fait** (#54), avant l'écran et non après. Déclaré dans `schema.prisma` par `@@unique(..., where:)` avec la preview feature `partialIndexes` (Prisma 7.8), pas en SQL manuel. Le `findFirst` de `startSession` reste : il donne le 409 lisible, l'index garantit.
- **2026-10-09 · Sessions oubliées : fermeture paresseuse après 2 h sans bloc loggé** (au Start, à la lecture, au log), pas de cron. `endedAt` reçoit la date de la dernière activité. Remplace « environ 6 h » du 2026-09-29. Un End tardif est daté de la même façon.
- **2026-10-09 · `GET /sessions/active`** renvoie la board et `entries` (les passages, avec le bloc, sa cote et son angle). Pas de rating ni de grade ressenti : le critère est ce que l'écran affiche.
- **2026-10-12 · `GET /sessions/:id`** : même forme que la session active. 403 sur la session d'un autre, comme `endSession`.
- **2026-10-09 · L'historique mobile masque les sessions vides ou en cours.** Filtre côté mobile (`select` de `useMySessions`), la route renvoie tout.
- **2026-10-17 · BLE dégelé, priorité du moment** : se connecter à la board et utiliser l'app en conditions réelles. Remplace « BLE gelé » (2026-07-31). Lib et architecture : `docs/notes/ble-reprise.md`.
- **2026-10-20 · Connexion à une board : carte « Board » sur Home**, en Bluetooth seulement. Remplace l'encart prévu sur l'onglet Session. Boards par emplacement (géolocalisation, carte des salles) : V2, comme dans le cahier des charges.
- **2026-10-23 · Board de Seb : 12 x 12 with kickboard (taille 10)**, confirmée en salle. Nom diffusé `nom#série@niveau` (`Kilter Board#75804@3`), `parseBoardName` corrigé (#85).
- **2026-10-23 · Une board = sa série** (#86) : elle s'annonce sous plusieurs identifiants BLE autour d'une connexion. Une ligne par série ; Connect essaie chaque identifiant dans l'ordre du scan, 8 s chacun.
- **2026-10-23 · Envoi en plusieurs paquets** (`first`, `middle`, `last`) au-delà de 84 prises (#86), validé sur la board (97 prises). Une limite de prises par bloc, comme l'app Kilter, sera fixée avec la création de bloc.
- **2026-10-23 · Écran d'essai BLE conservé** comme outil de diagnostic, jusqu'à ce que la vraie connexion le remplace. Un sélecteur de prises à la main y est écarté : il demanderait de committer le catalogue, et fait doublon avec l'écran de création.

API
- **2026-09-29 · Rate limiting de l'auth** : `ThrottlerGuard` sur `AuthController`, `register` 3/min, `login` 5/min, `refresh` et `logout` exclus. Consigné au CHANGELOG (Unreleased).
- **2026-07-30 · `GET /auth/me` supprimé**, `GET /users/me` le remplace. `getMe` lève 401 et non 404 : le mobile ne se déconnecte que sur un 401.
- **2026-07-30 · `GET /users/:username` ne renvoie jamais `email` ni `role`.** Le type mobile `UserProfile` les exclut : la règle est portée par le type.
- **2026-07-30 · Projet en cours** : compteur `sessionsCount` sur `Ascent`, pas de table par séance. `attemptsToAdd` s'additionne côté serveur (`increment`).
- **2026-07-30 · `REPEAT` hors MVP.** Complété le 2026-10-15 : un second envoi est un SENT, et `POST /ascents` refuse REPEAT (`@IsIn` dans le DTO). Le réactiver : l'ajouter à `CREATABLE_STATUSES` et écrire ses règles ; côté mobile, ajouter REPEAT au type `AscentStatus` (environ une demi-journée).
- **2026-10-15 · Transitions en liste blanche** (#73) : `PATCH` n'autorise que PROJECT → SENT. 400 si la cible n'est jamais valide (FLASH, PROJECT, REPEAT), 409 si l'ascension n'est plus un projet (complétion renvoyée après une réponse perdue, séance sur un envoi) ; le mobile relit alors l'état. Remplace « accepté sans effet », écarté parce que la complétion porte aussi le grade et les essais.
- **2026-10-15 · Ascensions, premier contact à une inclinaison** : FLASH (1 essai), SENT ou PROJECT. Un projet ne s'ouvre qu'au premier contact (B9) : il se travaille sur un bloc jamais fait, et sa complétion est toujours le premier envoi.
- **2026-10-15 · Le premier envoi porte tout ce qui est unique** : grade ressenti (obligatoire), note en étoiles (facultative, B10) et commentaire public (facultatif, B7). Ensuite, notes privées seulement. Le premier envoi se reconnaît à son vote (`feltGradeId`).
- **2026-10-15 · Un bloc privé ou brouillon n'existe que pour son créateur** : 404 pour tous les autres, sur toute route qui le désigne (B4). Le créateur peut ajouter ses brouillons à ses playlists.
- **2026-10-15 · `POST /auth/logout` exige le token de l'appareil** (B8) : son absence ne déconnecte plus tous les appareils. « Déconnecter tous les appareils » sera une route explicite.
- **2026-10-15 · Le seed respecte les règles de l'API** : il écrit sans passer par elle, donc ce qu'elle refuserait ne doit pas y entrer. Correctif plutôt que migration de données pour des données qui ne viennent que du seed.
- **2026-10-12 · Un refresh token par appareil** (#63) : `generateTokens` ne supprime que les tokens expirés de l'utilisateur. Le token présenté au refresh reste valide 60 s (`REFRESH_REUSE_GRACE_MS`) pour couvrir une réponse perdue. `POST /auth/logout` ne révoque que le token envoyé.
- **2026-10-12 · Playlists** : `GET /playlists/me?boulderId=` renvoie `containsBoulder` par playlist (#61). `GET /playlists/:id` trie ses blocs par position, puis ajout le plus récent (#62).
- **2026-10-12 · Limite de 3 tags par bloc** : à poser dans la validation le jour où la création d'un bloc existe. Aujourd'hui aucune route ne crée de bloc ni n'attribue de tag.
- **2026-10-14 · Favoris : `PUT` et `DELETE /boulders/:id/like`, idempotents** (#65) : `createMany` + `skipDuplicates`, et `deleteMany`. Un renvoi après une réponse perdue réussit sans rien changer. `PUT` renvoie `{ liked }`, car le client `put` lève sur un corps vide.
- **2026-10-15 · `GET /playlists/me` trie de la plus récente à la plus ancienne** (#69).
- **2026-10-14 · `GET /boulders/:id/like` séparé** de `GET /boulders/:id`, qui reste public : pas de guard JWT optionnel, et un tap n'invalide que l'état du cœur.
- **2026-10-21 · Table des cotations à la granularité Font**, reprise de `board_difficulty_grades` (#83) : 4a à 8c+, `rank` = `difficulty` Kilter (10 à 33), V dérivé et non unique.
- **2026-10-21 · L'API n'envoie que des rangs** (`gradeRank`, `feltGradeRank`) ; le mobile les traduit dans l'échelle de l'utilisateur (#83).
- **2026-10-21 · `GET /ascents/me`** : cotation effective à l'inclinaison de l'ascension, tri par date d'envoi, projets ouverts en tête (#82).
- **2026-07-30 · Tests e2e de l'API reportés.** Conception déjà faite : `docs/notes/api-tests.md`.

Mobile
- **2026-09-29 · Client API (corps vide)** : `get/post/put/patch` lèvent sur un corps vide, `api.getOrNull` est réservé aux vides légitimes, `delete` renvoie `void`.
- **2026-10-19 · Expo SDK 58 et development build** (#77). Remplace « SDK 55 » (2026-07-30) : avec Xcode 27, iOS 27 ne lance plus une app sans cycle de vie UIScene, que seul le modèle du SDK 58 adopte. Cible iOS 16.4 (`expo-build-properties`) ; plugin `with-pods-deployment-target` pour les Pods. Détail : `docs/notes/expo-dev-build.md`.
- **2026-10-19 · `redirectTo="/login"` sur le `Stack.Protected` authentifié** : obligatoire depuis expo-router 58.
- **2026-10-20 · `BoardConnection` : interface, version simulée d'abord** (`lib/board/`). L'état est une union discriminée sur `status`, gardée dans un store zustand global : la connexion survit à l'écran qui l'ouvre.
- **2026-10-23 · `BleManager` unique, possédé par `RootLayout`** (state, comme `QueryClient`), créé au premier scan et non au lancement : sinon iOS alerte à chaque démarrage quand le Bluetooth est coupé. Remis au store par injection, partagé par un contexte avec l'écran d'essai (#86). Complète la décision du 2026-10-20. Écarté : constante de module cachée sur `globalThis`.
- **2026-10-20 · `publicHoistPattern: ['@types/react']`** dans `pnpm-workspace.yaml` : pnpm 11 ignore `shamefully-hoist` de `.npmrc`, et react-native-svg comme React Navigation ne trouvaient les types de React que par hasard.
- **2026-07-30 · `logout()` vide le cache TanStack dans `AuthContext`**, pas dans un écran.
- **2026-07-29 · Explore** : seul le grand titre se replie au scroll. Recherche, Filters et chips restent fixes.
- **2026-07-30 · Pastille de statut sur les cartes Explore : hors MVP.** Conception conservée : `docs/notes/explore.md`.
- **2026-07-30 · Profil** : taux de flash, Follow et Edit profile différés. Détail : `docs/notes/profil-backlog.md`.
- **2026-10-21 · Profil : les 5 dernières ascensions**, avant les actions, et « See all » vers `/ascents`, paginé au scroll (#82).
- **2026-10-21 · Échelle de cotation au choix, Font par défaut** (#83) : réglage « Grade scale » sur le profil ; table en dur `lib/grades/scale.ts`, libellé par `useGradeLabel`. Le grade ressenti se vote toujours en Font, avec le V en rappel. Les filtres parcourent les crans de l'échelle choisie.
- **2026-10-21 · Timeout de 10 s sur toutes les requêtes** (`lib/api/request.ts`, `NetworkError`) ; au démarrage, un serveur muet donne l'écran hors ligne avec Retry, en un seul essai, au lieu de l'écran de connexion (#80).
- **2026-10-23 · Curseur de plage maison** (`components/RangeSlider.tsx`, PanResponder) : `rn-range-slider` ne recevait plus aucun geste sous React Native 0.88 (#84).
- **2026-10-08 · Toast de confirmation après un log d'ascension.** Fait le 2026-10-09 (#57) : store zustand, `ToastHost` à la racine, et bouton de log figé sur « Logged » le temps du toast.
- **2026-10-09 · Pastille de session dans le header** : contour neutre au repos (ne pas avoir de session n'est pas une alerte), point gold et chrono quand elle tourne. Absente de l'onglet Session.
- **2026-10-12 · Écrans de détail (bloc, session) : barre native conservée**, avec la pastille de session. Utilise `unstable_headerRightItems` (API instable de React Navigation) : à revoir à chaque montée de version.
- **2026-10-09 · `QueryClient` dans un state de `RootLayout`**, pas en constante de module : il survit au rechargement à chaud.
- **2026-10-09 · Start et End invalident dans `onSettled`** : après un 409, l'écran relit l'état au lieu de rester sur un bouton qui échoue. Étendu le 2026-10-15 à `useUpdateAscent` (#73).
- **2026-07-30 · Boulder detail** : la note privée est masquée en mode In Project tant qu'aucun écran ne la relit. Design cible et backlog : `docs/notes/boulder-detail.md`.
- **2026-10-12 · Favoris : table dédiée, pas une playlist spéciale.** Fait le 2026-10-14 (#65) : cœur en mise à jour optimiste, grisé tant que l'état est inconnu ; segment « Liked » au centre de Library. Visibilité dans le profil : pas encore faite.
- **2026-10-14 · « Liked » et non « Favorites »** : la liste reprend le verbe de l'action (cœur, Like / Unlike).
- **2026-10-12 · « Add to playlist »** (#61) : bouton sous le bouton de log, feuille native où un tap bascule l'appartenance du bloc. Pas de toast dans une feuille : il serait rendu dessous.
- **2026-10-12 · Détail d'une playlist** (#62) : retrait d'un bloc, suppression et édition (nom, description, visibilité) réservés au propriétaire.
- **2026-10-12 · Réordonner les blocs d'une playlist : reporté.** Glisser-déposer et non flèches ; demande des bibliothèques natives et un development build.
- **2026-10-12 · Une playlist n'est pas verrouillée à une inclinaison** : on y mélange librement les inclinaisons. Complété le 2026-10-15 : chaque entrée porte la sienne (#68).
- **2026-10-12 · Bouton « ampoule » pour allumer un bloc sur la Kilter** : bouton rond flottant sur l'image de la board. À faire avec le BLE, pas avant : un bouton sans effet se lit comme une panne. Complété le 2026-10-23, comme l'app Kilter : si un autre grimpeur a pris la board, un tap propose d'afficher son bloc, se reconnecte, puis l'allume.
- **2026-10-15 · Library : bouton + flottant pour créer une playlist** (#69), avec une feuille commune à la création et à l'édition (`PlaylistFormSheet`). Détail d'une playlist : croix de retrait à gauche, cotation à droite.
- **2026-10-15 · Sans cotation à son inclinaison, une carte affiche « Not graded »** (badge neutre), et un tiret dans les cercles des passages de session.
- **2026-10-12 · Le refresh a trois issues** (`refreshed`, `rejected`, `unavailable`) ; seul `rejected` déconnecte (#63).

Inclinaison (décidé le 2026-10-12, étape 1 faite le 2026-10-15 (#66), étape 2 le 2026-10-15 (#70) — détail : `docs/notes/boulder-angle.md`)
- **2026-10-15 · Principe : le même bloc à une autre inclinaison est un autre bloc.** Le créateur fixe l'inclinaison par défaut du bloc (`boulders.angle_id`) ; chaque action de l'utilisateur (ascension, like, entrée de playlist) enregistre la sienne.
- **Deux envois à deux inclinaisons sont deux réussites distinctes.** Flash, projet ouvert et grade ressenti au premier envoi passent « par bloc et par inclinaison ». L'ascension enregistre son inclinaison.
- **Sélecteur d'inclinaison dans l'en-tête du détail d'un bloc**, local à l'écran : il ne modifie jamais le filtre d'Explore. **À l'ouverture : l'inclinaison du lien** (`boulderHref` : la carte d'Explore, l'ascension d'un projet ou d'un passage), sinon celle du créateur. Remplace « dernière inclinaison choisie » (2026-10-15).
- **2026-10-15 · `angleDegrees` obligatoire sur `POST /ascents`, sans défaut serveur** : seul le client connaît l'inclinaison réelle, et un défaut ferait d'un oubli une donnée fausse et silencieuse.
- **2026-10-15 · Commentaire public : un par utilisateur, par bloc et par inclinaison.** L'écran n'affiche que ceux de l'inclinaison choisie ; la clé de liste est l'id du commentaire.
- **2026-10-15 · Favoris et entrées de playlist portent leur inclinaison** (#68), dans leur clé primaire : le même bloc à deux inclinaisons fait deux favoris ou deux entrées. Routes : `?angle=` (degrés) sur le like et sur le retrait d'une playlist, `angleDegrees` dans le corps de l'ajout.
- **Cotation par inclinaison : la communauté remplace le créateur à partir de 5 votes**, par la médiane des grades ressentis. Sans cotation de départ à cette inclinaison : « estimée » sous le seuil. Un vote par personne, par bloc et par inclinaison.
- **2026-10-15 · Table `boulder_angles` (choix « B + D »)** : clé `(boulder_id, angle_id)`, une ligne par inclinaison, toutes créées avec le bloc. Les ascensions, favoris et entrées de playlist y pointent par une clé étrangère composée. Elle porte la cotation effective et les votes ; `boulders.grade_id` et `angle_id` restent la référence du créateur. Remplace `boulder_angle_grades` et « les autres au premier vote ».
- **2026-10-15 · Un vote = le grade ressenti du premier envoi**, un par grimpeur, bloc et inclinaison. L'API le refuse ailleurs (POST hors premier envoi, PATCH hors complétion d'un projet), et l'index partiel `ascents_one_felt_grade_per_user_boulder_angle` le garantit (3371a76).
- **2026-10-15 · Médiane basse** pour un nombre pair de votes (V5 entre V5 et V6). Seuil : `COMMUNITY_GRADE_THRESHOLD = 5`. Règle unique dans `apps/api/src/boulders/community-grade.ts`, recalcul dans la transaction du vote, avec verrou de ligne.
- **2026-10-15 · Explore filtré à une inclinaison : envois seulement.** Un bloc y apparaît s'il y est coté : à l'inclinaison du créateur, ou dès un envoi ailleurs. Un projet sans envoi ne suffit pas. Le filtre se fait dans la requête, pas sur le mobile, à cause de la pagination.
- **2026-10-15 · Inclinaison de la board déclarée en début de séance** (avec le BLE) : elle pré-règle le filtre d'Explore, qui reste modifiable. Le lien garde la priorité : un bloc liké à 50° s'ouvre à 50°.
- **2026-10-15 · Compte rendu de session : afficher l'inclinaison de chaque passage**, pour distinguer le même bloc à deux inclinaisons sans ouvrir la fiche. Fait le 2026-10-21 (#81).
- **Affichage** : la cotation effective seule ; celle du créateur en petit, seulement si elle diffère. Message neutre indiquant que le grade ressenti compte dans la cotation. Fait (#70) : « Set as V5 · n votes », « Estimated · n votes ».

Général
- **2026-10-08 · Fin de session** : mise à jour de ce fichier, commit, push, puis `/clear`. Ni `/compact` ni prompt de reprise : ce fichier est importé à chaque session.
- **2026-10-08 · Pas de SQL écrit à la main** quand Prisma sait l'exprimer : vérifier d'abord ce que la version installée supporte.
- **2026-10-15 · SQL à la main autorisé pour une migration de données** (remplissage avant un `NOT NULL`), en complétant le fichier généré par `migrate dev --create-only`.
- **2026-10-12 · L'agent ne se connecte jamais avec un compte que Seb utilise sur son téléphone.** Vérifications HTTP avec `test_user_15` uniquement. (Le 2026-10-09, une connexion de l'agent en `test_user_1` avait déconnecté le téléphone.)
- **2026-10-15 · Deux agents en parallèle : un worktree chacun.** Un contrôle par mutation ne touche qu'un fichier sans modification en cours. (Le 2026-10-15, une restauration par `git checkout` a effacé le travail non commité de l'autre agent.)
- **2026-10-15 · Les tests partent des règles métier, pas du code** : protocole dans `docs/notes/api-tests.md` (#72), contrôle par mutation, matrice `docs/notes/api-tests-matrice.md`. Une règle portée par un DTO se teste dans une spec de DTO.
- **2026-10-19 · Données Kilter : snapshots publics de boardsesh**, BoardLib ne fonctionnant plus depuis la fermeture du backend Aurora (mars 2026). Usage personnel ; aucune base commitée (script de téléchargement par le manifeste) ; pas de photo de la board, le plan des prises est dessiné par l'app. Détail : `docs/notes/kilter-data.md`.
- **2026-10-20 · Schéma des prises : choix B.** `Hold` reste la prise posée, avec l'id Kilter du placement, son set et ses vraies coordonnées. Nouvelles tables `BoardSize` et `HoldLed(holdId, sizeId, position)`, plus une taille sur `Board`. `boulder_holds` ne change pas. Écarté : recopier les 4 tables Kilter (trous, placements, tailles, LED).
- **2026-10-20 · Les deux sets dans le modèle** (Bolt Ons et Screw Ons) : la board de Seb a les deux.
- **2026-10-20 · Catalogue Kilter : filtrer toujours sur `board_type = 'kilter'`.** Les ids (trous, tailles) se répètent d'une marque à l'autre.
- **2026-10-20 · Couleur LED du start : `00FF00`** (`led_color`), et non `00DD00` (`screen_color`). `docs/ble-protocol.md` corrigé.
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
| Un grade ressenti par grimpeur, bloc et inclinaison | **Tenu** (3371a76) par l'API et l'index partiel ; refus vérifié en HTTP réel. Index : pas d'e2e. |
| Cotation recalculée à chaque vote | **Tenu** (#70) dans la transaction du vote, avec verrou ; vérifié en HTTP réel. Concurrence non testée. Un vote ne peut plus être retiré (B1 corrigé). |
| Une note (étoiles) par grimpeur, bloc et inclinaison | **Tenu** (#74) par l'API. Pas d'index propre : garanti indirectement par celui du grade ressenti (la note n'est acceptée qu'au premier envoi, qui porte un vote). |
| Transitions de statut : projet → envoi seulement | **Tenu** (#73), liste blanche ; tests et mutations. |
| Projet seulement au premier contact, un seul ouvert | **Tenu** (#74) par le service. Pas d'index : deux `POST` simultanés peuvent ouvrir deux projets (e2e). |
| Timeout sur les `fetch` mobiles | **Tenu** (#80) : 10 s, puis `NetworkError`. Vérifié sur iPhone avec une IP injoignable (login, démarrage, Retry). |
| Docker / docker-compose | **Absent.** Prévu pour les tests e2e de l'API. |
| `REPEAT` | Valeur dans l'enum, refusée en création (#74) ; jamais atteinte par `PATCH` (#73). |

## Périmètre

- Modules API existants : `auth`, `users`, `boulders`, `ascents`, `sessions`, `playlists`, `grades`, `admin`.
- Modules API prévus : `boards`, `feed`, `challenges`.
- Écrans mobiles placeholder : aucun. Home n'a que la carte Board pour l'instant.
- Tests : unitaires sur `apps/api` seulement (Prisma mocké), services et DTO ; aucun e2e, aucun test mobile. Dette e2e listée dans la matrice.
- Outillage : collection Bruno dans `apps/api/bruno/`. Comptes de test dans `prisma/seed.ts` (`kilter_admin`) et `prisma/seed-dev.ts` (`test_user_N`). Recalcul des cotations : `db:recompute-grades`.
- Pièges Jest du monorepo et conventions de spec : `docs/notes/api-tests.md`.

## Questions ouvertes

- Une identité BLE de passage accepte-t-elle la connexion sans rien allumer ? À tester board libre : chaque identité tour à tour, avec un motif.
- Connexion possible pendant qu'un autre grimpeur est connecté : une connexion par identité ? À confirmer.
- Carte Board, relancement avec le Bluetooth coupé : message à retester (mis de côté le 2026-10-23).
- Limite de prises par bloc : quelle valeur (celle de l'app Kilter) ? À fixer avec la création de bloc.
- Encart de signalement de bug (après la connexion à la board) : les rapports vont dans une table lue par l'admin, ou en issue GitHub ?
- Compteur « Ascents » du profil : pas rafraîchi après un log (seulement en tirant l'écran). Pour la série sur le profil.
- `.npmrc` : `shamefully-hoist=true` n'a plus d'effet sous pnpm 11. Le supprimer ?
- `pnpm-workspace.yaml` : exclusions de `minimumReleaseAge` pour les paquets Expo 58 (versions exactes). À retirer quand ces versions auront l'âge requis ?

- Dates en base : celles écrites par Prisma sont décalées de 2 h par rapport à `now()` en SQL (PostgreSQL en `Europe/Paris`). L'API est cohérente avec elle-même ; toute requête SQL à la main qui compare avec `now()` est fausse. Cause et impact à vérifier.
- Explore sans filtre d'inclinaison : une carte par bloc, ou une carte par couple coté (bloc, inclinaison) ? La règle « envois seulement » ne tranche que le cas filtré.
- Filtre Explore « jamais fait » : jamais fait **à cette inclinaison**. Sans filtre d'inclinaison, son sens dépend de la question précédente.
- `GET /sessions/me` et `GET /boulders/likes/me` ne sont pas paginés. À trancher ensemble.
- Statistiques du bloc : le nombre d'ascensions compte chaque ligne (repeats et projets compris) ; nombre d'ascensions ou de grimpeurs ? Et faut-il les afficher, avec la note moyenne, par inclinaison sur le détail du bloc ? Seb n'a pas tranché (2026-10-15).
- `login` renvoie 200 et `refresh` 201 : l'agent recommande d'aligner `refresh` sur 200 dans une branche `fix/`. À décider.
- Test manuel à faire sur téléphone : arrêter l'API, attendre 15 min que le token d'accès expire, utiliser l'app (une erreur doit s'afficher, sans retour à l'écran de connexion), relancer l'API. Marche à suivre dans `docs/notes/mobile-reseau.md`.
- Route « déconnecter tous les appareils » (B8) : à concevoir, avec son bouton.
- Le like et le log d'une ascension refusent aussi au créateur son propre brouillon, contrairement à la règle B4. À aligner le jour où la création de blocs existera.
- Le commentaire d'une complétion part dans une seconde requête après le `PATCH` : si elle échoue, le projet est terminé sans son commentaire public, et il ne peut plus être ajouté.
- L'authentification n'a de test automatique que côté service. Le scénario à deux appareils et tout le côté mobile ne sont vérifiés qu'à la main : meilleur candidat pour démarrer les tests e2e.
