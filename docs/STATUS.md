# État du projet — audit du 2026-09-27

Audit en lecture seule de `develop` (HEAD `ac42dae`, version 0.1.0 publiée).
Seul ce fichier a été créé ; rien n'a été modifié, installé ni corrigé.

**Modifications non commitées trouvées dans l'arbre de travail** (pas faites par l'audit) :

| Fichier | Nature |
| --- | --- |
| `apps/api/src/sessions/sessions.service.ts` | `getActiveSession` : le `select` des ascensions est élargi à `grade` + `angle` (c'est la dette Sessions n°3). Travail en cours sur Session. |
| `apps/mobile/lib/api/client.ts` | `apiFetch` renvoie `null` quand le corps est vide (204, ou `GET /sessions/active` sans session active). Préparation de `useActiveSession`. |
| `CHANGELOG.md` | **Supprimé**, alors que le dernier commit (`ac42dae`) venait de le rapatrier depuis `main`. Ça ressemble à une suppression accidentelle. À vérifier avant tout commit. |
| `docs/ble-protocol.md` | Non suivi par git : la spec BLE n'est pas encore commitée. |

---

## 1. Écrans (`apps/mobile/app`)

| Route | Statut | Détail |
| --- | --- | --- |
| `(auth)/login` | ✅ Réel | Branché sur `useAuth().login`, accepte un email ou un username, gère l'état d'envoi et les erreurs. |
| `(auth)/register` | ✅ Réel | Branché sur `useAuth().register`, affiche un indice sur les règles de mot de passe. Aucune validation côté client : tout repose sur le 400 du serveur. |
| `(tabs)/index` (Home) | 🟡 Placeholder | **C'est un échantillon de contrôle des polices** (le commentaire dit « À remplacer par le vrai écran Home »). Données en dur : `47:12`, `45°`, `V6`, « Session du jour ». |
| `(tabs)/explore` | ✅ Réel | `useBouldersInfinite` avec scroll infini, recherche debouncée (300 ms), filtres (store zustand et chips `ActiveFilters`), titre repliable, pull-to-refresh, états chargement/erreur. |
| `(tabs)/session` | 🔴 Placeholder | Affiche uniquement le texte statique « Session ». Aucune query. |
| `(tabs)/library` | ✅ Réel, partiel | Segmented control **Projects / Playlists** branché sur `useMyProjects` et `useMyPlaylists`. **Il n'y a pas de segment « Liked »**, et c'est un choix documenté : le backend n'a aucun concept de favori sur un bloc. Les playlists ne s'ouvrent pas, faute d'écran de détail. |
| `(tabs)/profile` | ✅ Réel | Réutilise `components/profile/ProfileView` et `useUser(username?)`. Le bouton « Edit profile » est `disabled`, et il n'y a pas de Follow. |
| `boulder/[id]` | ✅ Réel | Utilise `useBoulder`, `useMyAscentsOnBoulder`, `useGrades`, `useLogAscent` et `useUpdateAscent`. On y trouve la carte `BoardLED`, le formulaire de log (FLASH/SENT/PROJECT), la gestion du projet (In Project / Sent), la note ★, le grade ressenti et les `publicNotes`. Le fichier fait 1 053 lignes. |
| `search` | ✅ Réel, **non listé** | Écran modal de filtres (créateur, plage de cotes avec `RangeSlider` vendorisé, angle, tags). Il écrit dans `useFiltersStore`. |

**Onglets (`(tabs)/_layout.tsx`)** : Home, Explore, **Session** (au centre, icône Zap), Library, Profile. L'onglet Connect a bien disparu et Projects s'appelle bien Library. Le commentaire de `session.tsx` confirme que l'appairage de la board, qui vivait dans Connect, doit y être déplacé.

**Écrans absents** (référencés par le code ou les commentaires) : `/user/[username]` (profil tiers, déjà prévu par `ProfileView`), le détail d'une playlist, le formulaire Edit profile.

---

## 2. Couche data (`apps/mobile/lib`)

| Module | Hooks / fonctions | Key factory | Verdict |
| --- | --- | --- | --- |
| `boulders` | `useBouldersInfinite`, `useBoulder` (avec `placeholderData` tiré des listes en cache) | ✅ `boulderKeys` | Complet pour Explore et le détail. Il y a deux imports séparés depuis `@tanstack/react-query` (l. 1 et l. 16), à fusionner. |
| `ascents` | `useLogAscent`, `useUpdateAscent`, `useMyAscentsOnBoulder`, `useMyProjects`, `deriveAvailableStatuses` | ✅ `ascentKeys` | Complet. `LogAscentPayload.sessionId?` est typé mais **aucun appelant ne le renseigne**. |
| `users` | `useUser(username?)` | ✅ `userKeys` (me / profile) | Complet. Attention : la signature prend un **`username`**, pas un `id` comme l'annonçait la roadmap. |
| `playlists` | `useMyPlaylists` | ✅ `playlistKeys` (`detail` déclaré mais inutilisé) | Lecture seule. Aucune mutation (créer une playlist, ajouter un bloc). |
| `grades` | `useGrades` | ❌ Clé inline `['grades']` | Fonctionnel, mais c'est le seul module sans factory. |
| `auth` | `AuthContext` (login, register, logout, bootstrap), `storage` (SecureStore) | – | Complet. |
| `api` | `client` (`api.get/post/patch`), `authBridge`, `errors` (`ApiError`), `config` | – | Complet. Contient la modification non commitée qui renvoie `null` sur un corps vide. |
| `filters` | `useFiltersStore` (zustand), `const.ts` (ANGLES, GRADES, TAGS **en dur**) | – | Voir la dette : `GRADES` fait doublon avec `useGrades`. |
| `format`, `hooks`, `vendor` | `relativeTime`, `useDebounce`, `RangeSlider` | – | Utilitaires. |
| **`sessions`** | — | — | **Absent.** Il n'existe ni `useActiveSession`, ni `useStartSession`, ni `useEndSession`. |
| `likes` | — | — | Absent, et cohérent avec l'absence de backend. |

Il n'y a **aucun `any`, `TODO`, `FIXME` ni `@ts-ignore`** dans le code mobile. Les types sont alignés sur les DTO, avec des commentaires qui expliquent pourquoi, par exemple le retrait de `email` et `role` dans `UserProfile`.

**Verdict Session** : ce n'est pas fait. Le backend est prêt, et deux modifications non commitées montrent que le chantier a démarré (l'élargissement du `select` et la gestion du corps vide dans le client). Mais côté mobile, il n'y a ni module `lib/sessions/` ni écran.

---

## 3. Dette technique

### Composants
- **`BoulderCard` n'est pas extrait.** Il est défini en inline dans `explore.tsx:21`. Library n'en fait pas de copie : il a sa propre `ProjectCard`, volontairement distincte parce que la réponse de `/users/me/projects` n'a pas la même forme. En revanche, **les styles de carte sont dupliqués** entre `explore.tsx` et `library.tsx` : `card`, `cardHeader`, `gradeBadge`, `gradeText`, `metaRow`, `metaData` et `metaDot` sont quasiment identiques. Le bloc « chargement / erreur + Retry » est lui recopié dans Explore, Library (`ListState`) et `ProfileView`.
- **Carte `BoardLED`** : elle existe (`components/BoardLED.tsx`) et elle est rendue dans `boulder/[id].tsx:207` à partir de `detail.holds`. Chaque prise a `x`/`y` sur une grille 12×12 et un rôle START/HAND/FOOT/FINISH, et les couleurs viennent des tokens `holds` du thème. C'est une visualisation dans l'app : le board physique n'est pas concerné.

### Marqueurs
| Fichier | Marqueur |
| --- | --- |
| `app/_layout.tsx:66` | `console.warn` sur un échec de chargement de police. Il est volontaire et commenté, donc acceptable. |
| `app/(tabs)/index.tsx` | Données en dur (`47:12`, `45°`, `V6`) : échantillon de polices. |
| `app/(tabs)/session.tsx` | Texte statique. |
| `lib/filters/const.ts` | `GRADES`, `ANGLES` et `TAGS` en dur alors que `GET /grades` existe : deux sources de vérité pour les cotes. |
| `lib/grades/queries.ts` | Clé de query inline. |

Il n'y a aucun `TODO`, `FIXME`, `@ts-ignore`, `any` ou `console.log` dans `apps/mobile`, ni dans `apps/api/src`.

### Styles littéraux hors `constants/theme.ts`
- **Hex** : aucun dans `app/`, `components/` ni `lib/`. Seul `app.json` contient `#ffffff` (splash et icône adaptative), ce qui est de la config native et donc normal.
- **Valeurs numériques en dur** :
  - `fontSize: 28` à `boulder/[id].tsx:957` est **le seul écart typographique réel**. Il faut le passer à `typography.size.*`.
  - Les hauteurs de contrôle se répètent : 44 dans `explore.tsx` et `search.tsx` ; 48 dans `AuthField`, `AuthButton`, `ProfileView`, `search.tsx` et `boulder/[id].tsx` ; 52 et 40 dans `boulder/[id].tsx`. Elles mériteraient un token `sizes.control`.
  - `borderWidth: 1` apparaît partout. On pourrait utiliser `StyleSheet.hairlineWidth` ou un token.
  - Les dimensions de la géométrie de `BoardLED` sont commentées comme du dessin et non des tokens. C'est défendable.
- Les `borderRadius` passent tous par `radii.*`.

---

## 4. Santé technique

| Vérification | Résultat |
| --- | --- |
| `pnpm --filter mobile exec tsc --noEmit` | ✅ Exit 0, aucune erreur |
| `pnpm --filter mobile run lint:ci` (`eslint --max-warnings 0`) | ✅ Exit 0 |
| `tsc --noEmit` dans `apps/api` (modifications non commitées incluses) | ✅ Exit 0 |
| CI | `.github/workflows/ci.yml` est présent |
| Docker | ❌ **Pas de `docker-compose.yml`**, alors que `CLAUDE.md` l'annonce |

**Workflow Expo**
- Expo SDK 55, RN 0.83.6, React 19.2, `newArchEnabled: true`.
- `expo-dev-client` n'est **pas installé**, et il n'y a **ni `eas.json` ni `app.config.*`** (juste `app.json`).
- **Expo Go ne peut pas lancer le projet** (SDK 55 plus récent que l'Expo Go du store). Aucun development build n'a encore été fait.
- `ios/` et `android/` sont déjà dans les deux `.gitignore` (racine et `apps/mobile`), donc le prebuild est sans risque de ce côté.
- Il manque `ios.bundleIdentifier` et `android.package` dans `app.json`. Il faudra les ajouter avant le premier build.

**BLE** : aucune librairie installée (pas de `react-native-ble-plx`, rien dans `pnpm-lock.yaml`). La spec existe (`docs/ble-protocol.md`), mais elle n'est pas commitée.

---

## 5. Backend (`apps/api`) : vérification ciblée

### Auth : les bugs signalés sont **tous corrigés**
| Point | État |
| --- | --- |
| register : `!existingUser` inversé | ✅ Corrigé : `if (existingUser) throw ConflictException` (`auth.service.ts:33`) |
| login : `bcrypt.compare` avec la mauvaise variable | ✅ Corrigé : `bcrypt.compare(dto.password, user.passwordHash)` (l. 70) |
| Retour de login non typé | ✅ `Promise<AuthTokens>` (`common/interfaces/auth-tokens.interface.ts`) |
| `generateTokens` non extraite | ✅ Extraite dans `TokenService` (`auth/token.service.ts`) |
| `constants.ts` au lieu de `JwtModule.registerAsync` + `ConfigService` | ✅ `registerAsync` avec `ConfigService` (`auth.module.ts`). `constants.ts` n'existe plus. |
| Mapping `expiresAt` | ✅ `expiresAt: new Date(Date.now() + expiresInMs)`, vérifié au refresh |
| Migration RefreshToken | ✅ `20260424172020_add_refresh_token` |

### Nouveaux constats sur l'auth (non listés dans la roadmap)
1. **🔴 Le rate limiting est inactif.** `@Throttle` est posé sur des méthodes de **`AuthService`**, alors que le throttler de Nest n'agit que sur les handlers de controller. En plus, aucun `ThrottlerGuard` n'est enregistré (ni `APP_GUARD` ni `@UseGuards`). Le `ThrottlerModule.forRoot` d'`app.module.ts` ne protège donc rien, et login/register restent ouverts au brute-force.
2. 🟠 Le refresh token est **stocké en clair** en base. Un hash SHA-256 suffit : c'est un secret aléatoire, pas un mot de passe, donc bcrypt n'est pas nécessaire.
3. 🟡 Il y a deux sources de vérité pour la durée de l'access token : `signOptions.expiresIn: '15m'` dans `auth.module.ts` et `expiresInMs: 15 * 60 * 1000` dans `TokenService`.
4. 🟡 `config.get<string>('ACCESS_TOKEN_SECRET')` renvoie `undefined` si la variable manque, et l'app démarre quand même. `getOrThrow` ou une validation d'environnement au boot ferait échouer le démarrage à la place.

### Sessions
| Endpoint | État |
| --- | --- |
| `POST /sessions` (start) | ✅ Refuse avec un 409 s'il y a déjà une session active (`findFirst`) |
| `PATCH /sessions/:id/end` | ✅ Vérifie l'existence et le propriétaire, puis refuse avec un 409 si la session est déjà terminée |
| `GET /sessions/active` | ✅ Renvoie la board et les ascensions. Le `select` élargi à grade et angle est **non commité**. |
| `GET /sessions/me` | ✅ Historique avec `_count.ascents` |

**Rattachement d'une ascension à la session** : il est **explicite uniquement**. `AscentsService.create` fait `sessionId: dto.sessionId ?? null`, sans jamais résoudre la session active. Comme le mobile n'envoie jamais `sessionId`, **aucune ascension n'est rattachée à une session aujourd'hui**.

**Index partiel unique** « une session active par utilisateur » : il est **absent des migrations**. Seul le `findFirst` protège l'invariant, ce qui laisse une fenêtre TOCTOU (double tap, retry réseau).

**`REPEAT`** : le statut existe dans l'enum Prisma mais n'est protégé par aucune règle de `create`. C'est une dette connue, hors MVP.

---

## 6. Roadmap restante priorisée

Effort : **S** ≈ < ½ journée, **M** ≈ 1–2 jours, **L** ≈ 3 jours et plus.

### (a) Finissable sans hardware

| # | Item | Effort | Dépendances |
| --- | --- | --- | --- |
| 0 | Trancher la suppression de `CHANGELOG.md`, puis commiter proprement le travail Session en cours et `docs/ble-protocol.md` | S | — |
| 1 | **Sécu auth** : déplacer `@Throttle` sur `AuthController` et enregistrer `ThrottlerGuard` | S | — |
| 2 | **Session backend** : rattachement implicite de `sessionId` à la session active (`null` explicite = hors session), puis index partiel unique par migration SQL manuelle | M | 2 change le contrat de `POST /ascents` ; à trancher avant 3 |
| 3 | **`lib/sessions/`** : `sessionKeys`, `useActiveSession` (retour `T \| null`), `useStartSession`, `useEndSession`, avec invalidations croisées vers `ascentKeys` | S | Modification de `client.ts` commitée |
| 4 | **Écran Session** (sans BLE) : état vide avec bouton Start, puis session active avec chrono dérivé de `startedAt`, liste des blocs faits (nom, cote, statut) et bouton End (note, partage) | M | 3 ; 2 pour que la liste se remplisse |
| 5 | **Home (dashboard)** : remplacer l'échantillon de polices. Contenu minimal : reprise de la session active, projets en cours, raccourci vers Explore | M | 3 (session active), `useMyProjects` |
| 6 | Hygiène UI : extraire `BoulderCard`, les styles de carte partagés et un composant `QueryState` (chargement/erreur/vide) ; corriger `fontSize: 28` ; token pour la hauteur des contrôles | S–M | Idéalement avant 5, qui réutilisera la carte |
| 7 | Grades : factory de clés et `GRADES` en dur remplacé par `useGrades` dans les filtres | S | — |
| 8 | Sécu auth, suite : hash du refresh token, `getOrThrow` et validation d'environnement, source unique pour la durée de l'access token | S | 1 |
| 8b | **Refresh mobile** : `AuthContext.refreshTokens` efface le refresh token et déconnecte sur n'importe quel échec, y compris une erreur réseau, un 5xx ou un 429. Il ne faudrait déconnecter que sur un 401. | S | Après 1 |
| 9 | Edit profile (formulaire sur `PATCH /users/me`, qui existe déjà) | M | — |
| 10 | Détail de playlist et ajout d'un bloc à une playlist | M | Mutations playlists côté mobile |
| 11 | Tests e2e API avec `docker-compose.yml` (conception déjà arrêtée). Ils doivent aussi couvrir le throttling : N logins ratés d'affilée, la tentative suivante doit renvoyer 429. | M | Prouve l'index du point 2 et le point 1 |
| 12 | Backlog différé : stats agrégées (taux de flash), REPEAT, Follow et `isFollowing`, Liked | L au total | Endpoints backend à créer d'abord |

### (b) Bloqué par le hardware (dev build + device + board)

| # | Item | Effort | Dépendances |
| --- | --- | --- | --- |
| B1 | **Development build** : ajouter `expo-dev-client`, `bundleIdentifier` et `package`, installer CocoaPods, lancer `expo run:ios --device` | S–M | iPhone et Mac. Signature 7 jours avec un Apple ID gratuit. |
| B2 | Interface `BoardConnection` et **adaptateur simulé** | M | Aucune : **faisable sans hardware**, à démarrer dès le point (a)4 terminé |
| B3 | Encodeur de trames d'après `docs/ble-protocol.md`, testé unitairement | M | Faisable sans hardware ; seuls les points « À VÉRIFIER » demandent la board |
| B4 | Adaptateur réel `react-native-ble-plx` (scan, connexion, écriture en chunks de 20 octets) | L | B1, un appareil physique, une board réelle |
| B5 | Mapping prise vers position LED réelle (base Aurora) et bouton « Display on board » | M–L | B3, B4, données de placement |

---

## 7. Écarts avec la roadmap intentionnelle

**Prévu comme fait, mais incomplet ou différent**
- **Library** : pas de segment *Liked*. C'est un choix assumé et commenté, faute de backend.
- **Profile** : le hook est `useUser(username?)` et non `useUser(id?)`. Edit profile est désactivé, et il n'y a ni Follow ni route de profil tiers.
- **Home** : ce n'est pas un écran vide mais un **échantillon de polices avec de fausses données**. Il ne doit pas partir en démo tel quel.

**Statut incertain, tranché**
- **Session : non faite côté mobile.** L'écran est un placeholder et `lib/sessions/` n'existe pas. Le backend est complet (4 endpoints). Deux modifications **non commitées** montrent que le chantier a démarré, mais le rattachement ascension → session est inexistant en pratique.

**Fait mais pas prévu dans la liste**
- L'écran modal **`search`** (filtres avancés) et le composant `ActiveFilters`.
- La **gestion complète du cycle de vie d'un projet** sur Boulder detail (séances, compteur `sessionsCount`, clôture en Sent).
- La carte **`BoardLED`** (visualisation 12×12).
- Les **bugs auth backend sont tous corrigés** et `TokenService` est extrait.
- La **spec BLE** (`docs/ble-protocol.md`) est rédigée, mais non commitée.
- La CI GitHub Actions est en place, et `tsc` et lint passent sur mobile et API.

**Pas prévu et problématique**
- Le rate limiting de l'auth est **inopérant** (voir §5).
- `docker-compose.yml` est absent, alors que `CLAUDE.md` l'annonce.
- `CHANGELOG.md` est supprimé dans l'arbre de travail.
