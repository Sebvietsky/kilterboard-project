# Matrice règle → tests de l'API

Tenue selon le protocole de `docs/notes/api-tests.md` (§7). Une ligne par règle. Mise à jour dans la PR qui change la règle ou ses tests.

Dernière passe complète : 2026-10-15, sur `feature/community-grade` (69394b6) et `chore/api-tests-audit`. 83 mutations (M = services, C = cotation, A = messages d'auth, D = DTO, F = correctifs de `fix/ascent-status-transitions`), toutes tuées, sauf M19 (seuil exact des 2 h). M03, M10 et M12 ont disparu avec la réécriture de leurs lignes (remplacées par F08, F01 et F07).

Abréviations :
- Sources : CdC = cahier des charges ; DEC = `DECISIONS.md` ; CL = `CLAUDE.md` > Règles métier ; code = commentaire de code seulement, règle à faire consigner.
- Porteurs : S = service ; D = DTO ; G = guard ; B = base.
- Specs : `asc` = `ascents.service.spec.ts`, `ses` = `sessions…`, `pl` = `playlists…`, `bo` = `boulders…`, `us` = `users…`, `au` = `auth.service…`, `tok` = `token.service…`, `cg` = `community-grade.spec.ts`, `*.dto` = spec de DTO du module.

## Ascensions

| Règle | Source | Porteur | Tests | Mutation | Manque |
| --- | --- | --- | --- | --- | --- |
| Bloc privé ou brouillon : 404 au log | code | S | asc › create — accès au bloc | M06 tuée | — |
| Inclinaison obligatoire, sans défaut | DEC 10-15 | D + S | asc.dto › refuse un log sans inclinaison ; asc › inclinaison inconnue | D01 tuée | — |
| Règles par bloc ET par inclinaison | DEC 10-15 | S | asc › ne lit l'historique qu'à l'inclinaison demandée | M01 tuée | — |
| Flash seulement au premier contact | CdC, DEC | S | asc › rejette un flash sur un bloc… | M02 tuée (masquée avant 2ec45eb) | — |
| Flash = 1 essai | CdC | S | asc › rejette un flash annoncé en n essais | M07 tuée | — |
| Projet seulement au premier contact à cette inclinaison (donc un seul ouvert) | DEC, Seb 2026-10-15 (B9) | S | asc › rejette un second projet actif ; refuse un projet après un SENT/FLASH ; ouvre un projet avec les essais de sa première séance | F08 tuée | — (B9 corrigé) |
| Projet actif : pas de SENT par POST | CdC §4.2 | S | asc › rejette un SENT tant qu'un projet est actif | M08 tuée (masquée avant 2ec45eb) | — |
| Après un envoi : un second SENT est un repeat (statut REPEAT inutilisé dans le MVP) | Seb 2026-10-15 (B6) | S | asc › « ne l'exige plus quand une ascension existe » | — | — (REPEAT refusé en création par le DTO : asc.dto › refuse REPEAT, F11 tuée) |
| Grade ressenti obligatoire au premier envoi | CL | S | asc › exige un grade ressenti au premier % | M05 tuée | — |
| Note (étoiles) seulement au premier envoi, comme le grade ressenti | Seb 2026-10-15 (B10) | S | asc › create — note ; refuse une note sur… (update) | F09, F10 tuées | unicité en base : non garantie (pas d'index) |
| Grade ressenti refusé ailleurs | 3371a76 | S | asc › refuse un grade ressenti sur… (create et update) | M04, M11 tuées | un seul grade par grimpeur en base : e2e |
| Transitions PATCH : projet → SENT uniquement ; 400 si la cible n'est jamais valide, 409 si l'ascension n'est plus un projet | CdC §4.2, Seb 2026-10-15 | S | asc › transitions de statut ; refuse tout passage à FLASH | F01, F02, F04 tuées | — (B1, B2 corrigés) |
| Complétion : grade, `wasProject`, `sendDate` | CdC | S | asc › update | F07 tuée | — |
| Séance : essais additionnés côté serveur, ≥ 1 | DEC 07-30 | S + D | asc › additionne… ; asc.dto › refuse une séance de 0 essai | M13, D03, F03 tuées | — (B3 corrigé : 409) |
| Suppression seulement en PROJECT | CdC | S | asc › remove | M14 tuée | — |
| Propriété : update, remove, note | — | S | asc › rejette… d'un autre utilisateur (403) | M09, M17 tuées | — |
| Mes ascensions = les miennes | implicite | S | asc › lecture de mes ascensions | M18 tuée | — |
| Rattachement : absent, `null`, id | DEC 07-31 | D + S | asc › transmet sessionId tel quel ; asc.dto › sessionId | D02 tuée | — |
| Passage écrit au log, à la séance, à la complétion ; rien sur une note | DEC 10-09 | S | asc › passage dans la session ; update | — | écriture imbriquée atomique : e2e |
| Commentaire public seulement au premier envoi à cette inclinaison (celui qui porte le vote) | CL, Seb 2026-10-15 | S | asc › createNote ; sur un envoi qui n'est pas le premier | M15, F05 tuées | — (B7 corrigé) |
| Une note publique par user, bloc et inclinaison | DEC 10-15 | S | asc › refuse une seconde note publique… | M16 tuée | concurrence : e2e |
| Note : non vide, ≤ 2000 caractères, visibilité connue | code | D | asc.dto › CreateNoteDto | D04 tuée | — |

## Cotation communautaire (étape 2)

| Règle | Source | Porteur | Tests | Mutation | Manque |
| --- | --- | --- | --- | --- | --- |
| Médiane basse, résistante aux aberrants | DEC, note boulder-angle | S | cg › medianGrade | C01 tuée | — |
| Créateur sous 5 votes, médiane à partir de 5 | DEC | S | cg › effectiveGrade | C02, C03 tuées | — |
| Autre inclinaison : rien sans vote, médiane dès le premier | DEC | S | cg › effectiveGrade | C06 tuée | — |
| « Estimée » : 1 à 4 votes hors inclinaison du créateur | DEC | S | cg › isEstimatedGrade ; bo › findOne | C04, C15 tuées | — |
| Seuls les envois à cette inclinaison votent | DEC | S | cg › ne compte que les grades ressentis d'envois… | C05, C09 tuées | — |
| Nombre de votes stocké | DEC | S | cg › écrit la médiane et le nombre de votes | C08 tuée | — |
| Verrou de ligne avant la lecture des votes | 3456556 | S | cg › verrouille la ligne avant de lire | C07 tuée | sérialisation réelle : e2e |
| Recalcul au premier envoi et à la complétion, jamais ailleurs | DEC | S | asc › vote pour la cotation | C10, C13 tuées | — (un envoi ne peut plus être retiré) |
| Ascension et recalcul dans la même transaction | 3456556 | S | asc › écrit l'ascension par le client de la transaction ; identité de `tx` | C11, C12, C14 tuées (C11 et C14 survivaient avant 2ec45eb) | atomicité : e2e |
| Une ligne `boulder_angles` par bloc et par inclinaison | 88e3d56 | B | — | — | e2e (clés composées) |

## Sessions

| Règle | Source | Porteur | Tests | Mutation | Manque |
| --- | --- | --- | --- | --- | --- |
| Une seule session active | CL | S + B | ses › refuse une seconde session ; remontée de la P2002 | M20, M26 tuées | index partiel : e2e |
| Fermeture paresseuse après 2 h, datée de la dernière activité | DEC 10-09 | S | ses › getActiveSession ; startSession | M21, M22 tuées | seuil exact : M19 survit (impact faible) |
| `resolveSessionId` : 404, 403, 409, `null` | DEC 07-31 | S | ses › resolveSessionId | M23, M24 tuées | — |
| End : 409 si terminée, 403 pour un autre, End tardif daté | DEC 10-09 | S | ses › endSession | M25 tuée | — |
| `GET /sessions/:id` : 403 pour un autre | DEC 10-12 | S | ses › getSession | M28 tuée | — |
| Historique = les miennes | implicite | S | ses › getMySessions | M27 tuée | — |

## Auth et utilisateurs

| Règle | Source | Porteur | Tests | Mutation | Manque |
| --- | --- | --- | --- | --- | --- |
| Mot de passe hashé | CdC | S | au › hache le mot de passe | — | — |
| Mot de passe 12–32 caractères, 4 classes ; username 3–20, `[a-zA-Z0-9_-]` | code | D | auth.dto › RegisterDto | D05, D09 tuées | — |
| Inconnu et mauvais mot de passe : même message | code | S | au › donne le même message… | M33, A01 tuées | — |
| Inscription refusée sans nommer le champ | code | S | au › ne nomme ni l'email ni le username | A02 tuée | — |
| Un refresh token par appareil, ménage des expirés seulement | DEC 10-12 | S | tok › generateTokens — connexion | M29 tuée | 2 appareils : e2e |
| Grâce de 60 s, sans rallonger un token | DEC 10-12 | S | tok › generateTokens — refresh | M30 tuée | — |
| Refresh expiré refusé ; token présenté transmis | DEC 10-12 | S | au › refreshToken | M32, M34 tuées | — |
| Logout : seulement ses tokens, seulement celui envoyé | DEC 10-12 | S | tok › deleteRefreshToken ; au › logoutUser | M31 tuée | **B8 : sans token, tous les appareils (non consigné)** |
| Rate limiting de l'auth | DEC 09-29 | G | — | — | e2e |
| `getMe` : 401 si le token ne désigne aucun compte | DEC 07-30 | S | us › rend 401… | — | — |
| Profil public sans email, rôle ni hash | DEC 07-30 | S | us › n'expose ni l'email, ni le rôle, ni le hash | M44 tuée | — |
| Profil privé : 403, sauf pour soi | code | S | us › getPublicProfile | M45 tuée | — |
| Pas de suivi de soi-même ni en double | code | S | us › follow | M46 tuée | — |
| Projets = ascensions PROJECT de l'utilisateur | code | S | us › getMyProjects | M47 tuée | — |

## Catalogue, favoris, playlists, admin

| Règle | Source | Porteur | Tests | Mutation | Manque |
| --- | --- | --- | --- | --- | --- |
| Catalogue et détail : publics et publiés seulement | code | S | bo › findAll, findOne | — | — |
| Commentaires : publics seulement | CdC | S | bo › findComments | M38 tuée | `/comments` d'un bloc privé non vérifié (faible) |
| Bornes de pagination, tag seul en tableau | code | D | boulders.dto › FilterBoulderDto | D06, D07 tuées | — |
| Like idempotent, par inclinaison, sur bloc visible | DEC 10-14, 10-15 | S + D + B | bo › like, unlike, isLiked ; boulders.dto › AngleQueryDto | M35, M36 tuées | unicité en base : e2e |
| Mes likes : les miens, à l'inclinaison du like, cotation effective | DEC 10-15 | S | bo › findMyLikes | M37 tuée | — |
| Publication réservée au créateur | code | S | bo › publishBoulder | — | — |
| Playlist privée visible du seul propriétaire | DEC 10-12 | S | pl › findOne | M42 tuée | — |
| Écritures réservées au propriétaire | DEC 10-12 | S | pl › propriété | M43 tuée | — |
| Entrée = bloc + inclinaison, doublon 409 | DEC 10-15 | S + D + B | pl › addBoulder ; playlists.dto › AddBoulderDto | M41, D08 tuées | unicité en base : e2e |
| Mes playlists = les miennes | implicite | S | pl › ne lit que les playlists de l'utilisateur | M40 tuée | — |
| Bloc privé ou brouillon : n'existe que pour son créateur (404 pour les autres) ; ajout en playlist | Seb 2026-10-15 (B4) | S | pl › rejette en 404 le bloc privé/brouillon d'un autre ; accepte le brouillon de son créateur | F12, F13 tuées | like et log refusent aussi le créateur sur son propre brouillon : à aligner quand la création de blocs existera |
| Nom de playlist non vide | code | D | playlists.dto › CreatePlaylistDto, UpdatePlaylistDto | F06 tuée | — (B5 corrigé) |
| `/admin` réservé aux ADMIN | CdC | G | roles.guard.spec | M48 tuée | `@Roles` sur le contrôleur : e2e |
| Tri admin par liste blanche | code | S | admin.service.spec, pagination.utils.spec | — | — |

## Dette e2e

Deux `POST PROJECT` simultanés : aucun index n'interdit deux projets ouverts sur le même bloc à la même inclinaison. Index et contraintes (sessions actives, grade ressenti unique, likes, entrées de playlist, clés composées `boulder_angles`), transactions (ascension + passage + recalcul), verrou `FOR UPDATE` sous concurrence, `ValidationPipe` réel (`forbidNonWhitelisted`), `@Roles` sur `AdminController`, `PrismaExceptionFilter`, throttling, refresh à deux appareils, cascades de `deleteBoulder`.
