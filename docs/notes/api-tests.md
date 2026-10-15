# Tests de l'API — outillage Jest et conception des e2e

## Deux pièges du monorepo (déjà levés, à ne pas réapprendre)

1. **`TypeError: this._moduleMocker.clearMocksOnScope is not a function`**
   - `react-native` (côté `apps/mobile`) tire `jest-environment-node@29`, et pnpm l'expose par son nom dans `node_modules/.pnpm/node_modules/`.
   - `apps/api` ne déclarait pas ce paquet : `testEnvironment: "node"` récupérait la 29, incompatible avec `jest-runtime@30`.
   - Corrigé en déclarant `jest-environment-node@^30` en devDependency explicite de `apps/api`.
   - Principe : dans un monorepo pnpm, ce qu'un package ne déclare pas, il peut l'hériter silencieusement d'un voisin.
2. **`Cannot find module './internal/class.js'`**
   - Le client Prisma 7 généré écrit ses imports en `.js` dans du TypeScript.
   - Corrigé par un `moduleNameMapper` `"^(\\.{1,2}/.*)\\.js$": "$1"` dans le bloc `jest` de `apps/api/package.json`.
3. **`TypeError: Reflect.getMetadata is not a function`** dans une spec de DTO
   - Les décorateurs de class-transformer lisent les métadonnées de type. Dans l'app, Nest charge `reflect-metadata` ; une spec qui n'importe que le DTO ne le charge pas.
   - Corrigé par `import 'reflect-metadata';` en première ligne de chaque spec de DTO.

## Conventions des specs de services

- Prisma est mocké (objet nu de `jest.fn()`) et injecté par `Test.createTestingModule` + `{ provide: PrismaService, useValue: prismaMock }`. Ces tests couvrent les règles métier, pas la persistance.
- Pas de `expect.objectContaining` imbriqués : les matchers Jest sont typés `any` et déclenchent `no-unsafe-assignment`. Relire l'argument passé au mock par un helper typé (`writtenData(mock)` dans `ascents.service.spec.ts`) et asserter avec `toMatchObject`.
- Un `beforeEach` pose le chemin nominal, chaque test ne surcharge que la condition qu'il isole.
- Vérifier qu'un test attrape vraiment quelque chose : voir « Contrôle par mutation » dans le protocole ci-dessous.

## Protocole d'écriture des tests (2026-10-15)

Origine : plus de 190 tests verts n'ont pas vu qu'un grimpeur pouvait voter plusieurs fois pour la cotation d'un bloc (corrigé par 3371a76). Le test « ne l'exige plus quand une ascension existe déjà » vérifiait qu'un envoi suivant passe sans grade, jamais qu'il est refusé avec un grade. Il suivait la branche du `if`, pas la règle, et il a figé le bug.

### 1. Partir de la règle, pas du code
- Avant d'ouvrir le service, écrire la règle en une phrase avec sa source : `CLAUDE.md` > Règles métier, `DECISIONS.md` (décision datée ou tableau des invariants), cahier des charges.
- Une règle sans source écrite se fait trancher par Seb et entre dans `DECISIONS.md` avant d'être testée.
- Le titre du test énonce la règle (« refuse un grade ressenti hors du premier envoi »), pas le chemin du code (« n'appelle pas grade.findUnique quand… »).

### 2. Décliner chaque règle
Chaque point applicable donne un test. Sinon, la matrice dit « sans objet ».
- **Accepté et refusé.** « X est obligatoire quand A » pose la question « X est-il interdit quand non-A ? ». La réponse vient de la source, jamais du code.
- **Cas limites** : seuils (2 h pile, 5 votes, 60 s de grâce), absent contre `null` explicite, première fois contre les suivantes.
- **Chaque dimension** : « par bloc et par inclinaison » demande un cas où seul le bloc change et un où seule l'inclinaison change. Même chose par utilisateur (les données d'un autre ne comptent pas) et pour la propriété (403 pour un non-propriétaire).
- **Idempotence**, quand elle est promise : rejouer l'appel réussit, sans second effet.
- **Ce que le refus protège** : asserter l'exception ET l'absence d'écriture (`expect(prismaMock.x.create).not.toHaveBeenCalled()`).

### 3. Où vit la règle, où on la teste
| Porteur | Test |
| --- | --- |
| Service | Spec du service, Prisma mocké |
| DTO (class-validator) | Spec du DTO : `plainToInstance` + `validate`, un cas valide et un cas refusé par contrainte. Le service ne voit jamais ces cas : le `ValidationPipe` filtre avant lui. |
| Guard | Spec du guard (modèle : `roles.guard.spec.ts`) |
| Base (unique, index partiel, FK, `NOT NULL`) | Dette e2e (§6) |

Une règle portée à deux niveaux se teste aux deux (exemple : session active, `findFirst` pour le 409 lisible, index partiel pour la garantie).

### 4. Contrôle par mutation
Pour chaque règle critique : casser la ligne qui la porte, lancer `pnpm --filter api test`, constater qu'au moins un test échoue, puis annuler.
- Mutations types : retirer un `throw`, inverser une condition, `&&` ↔ `||`, retirer un critère du `where` (`angleId`, `userId`), décaler un seuil (`>` → `>=`).
- Si rien n'échoue, la règle n'est pas testée, quel que soit le nombre de tests qui la mentionnent.
- Ne muter qu'un fichier sans modification en cours (`git diff -- <fichier>` vide), et de préférence dans un worktree dédié. Le 2026-10-15, la restauration d'une mutation a effacé le travail non commité d'un autre agent dans `ascents.service.ts`.
- Annuler par `git checkout -- <fichier>`, puis vérifier par `git status` que seuls les fichiers attendus sont modifiés. Une mutation n'est jamais commitée.
- Le résultat va dans la colonne « mutation » de la matrice.
- Outil possible : StrykerJS (runner Jest). Non adopté : la mutation manuelle et ciblée suffit tant que la suite tourne en ~1 min.

### 5. Anti-patterns
- **Câblage seul** : le test n'asserte que la forme d'un appel au mock. Admis seulement quand l'argument EST la règle (le `angleId` du `where` qui fait « par inclinaison » : avec un mock, c'est le seul moyen de le voir), et toujours avec un test de comportement à côté.
- **Tautologie** : le test passe quel que soit le code. Il asserte la valeur que le mock vient de renvoyer, ce que le `beforeEach` a posé, ou ne contient aucune assertion.
- **Recopie** : l'attendu est calculé comme l'implémentation le calcule. On l'écrit en dur, depuis la règle.
- **Bug figé** : le test vérifie la moitié permissive d'une règle (« passe sans grade ») sans la moitié restrictive (« refuse avec grade »).
- **Masquage** : un test de refus passe parce qu'une autre règle lève la même exception avant la sienne. Exemple du 2026-10-15 : « rejette un flash sur un bloc déjà grimpé » restait vert sans la règle du flash, car son DTO portait un grade ressenti, refusé par 3371a76. Le DTO d'un test de refus ne viole que la règle testée, et l'assertion porte sur le message, pas seulement sur le type d'exception. Après l'ajout d'une règle, relancer les mutations des règles voisines.
- **Mock aveugle** : un `findMany` qui renvoie la même chose quel que soit le `where` ne voit pas un filtre manquant. Le compléter par une assertion sur le `where`, ou par un `mockImplementation` qui filtre.

### 6. Ce qu'un test à Prisma mocké ne prouve pas
Contraintes uniques et index partiels, clés étrangères, cascades, `NOT NULL`, atomicité des transactions, concurrence (deux requêtes simultanées), `ValidationPipe` réel, ordre des guards, `PrismaExceptionFilter`, throttling.
- Ces cas figurent dans la matrice avec le verdict « e2e ». On ne les simule jamais par un mock.
- Nuance : tester que le service traduit une `P2002` en 409 est légitime. Cela teste le service, ça ne prouve pas que la base lève l'erreur.

### 7. Matrice de traçabilité
`docs/notes/api-tests-matrice.md` : une ligne par règle. Colonnes : règle, source, porteur, tests (fichier › titre), mutation (date, ligne cassée, résultat), manque.
- Mise à jour dans la PR qui change la règle ou ses tests.
- Une nouvelle règle dans `DECISIONS.md` ajoute une ligne à la matrice.

## Tests e2e — reportés le 2026-07-30, conception à reprendre telle quelle

Ne pas relancer le chantier sans que Seb le demande. Estimation : 3 à 4 h, infrastructure comprise. Non bloquant pour le MVP.

Pourquoi : les tests unitaires mockent Prisma, donc ne traversent jamais le `ValidationPipe`, les guards dans leur ordre réel, le `PrismaExceptionFilter` ni les garanties de la base.

Décisions prises :
- Base de test par Docker Compose + une base `kilterboard_test`, plutôt que Testcontainers. En CI, `services: postgres` de GitHub Actions le remplace.
- Isolation par `TRUNCATE ... CASCADE` entre chaque test. Le rollback de transaction est impossible : `TokenService.generateTokens` ouvre son propre `$transaction`, et Postgres n'imbrique pas les transactions.
- Pas de seed global partagé : chaque test crée ses données.
- Script `test:e2e` séparé de `test`, pour garder la boucle unitaire rapide.

Périmètre utile (ne pas rejouer les tests unitaires en e2e) :
1. Parcours d'auth complet : register → login → appel authentifié → refresh → refresh une seconde fois.
2. Validation : requêtes malformées → 400, champ en trop → `forbidNonWhitelisted`.
3. Guards : 401 sans token, 403 sur `/admin` avec un compte USER.
4. Deux `POST /sessions` d'affilée, pour prouver l'index partiel unique.
5. Throttling auth : enchaîner des logins ratés, la N+1ᵉ tentative doit renvoyer 429. Réinitialiser le storage du throttler entre les tests.

Pièges de config : `test/jest-e2e.json` a besoin du même `moduleNameMapper` que la config unitaire, plus un `globalSetup` qui applique les migrations.
