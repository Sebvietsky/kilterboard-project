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

## Conventions des specs de services

- Prisma est mocké (objet nu de `jest.fn()`) et injecté par `Test.createTestingModule` + `{ provide: PrismaService, useValue: prismaMock }`. Ces tests couvrent les règles métier, pas la persistance.
- Pas de `expect.objectContaining` imbriqués : les matchers Jest sont typés `any` et déclenchent `no-unsafe-assignment`. Relire l'argument passé au mock par un helper typé (`writtenData(mock)` dans `ascents.service.spec.ts`) et asserter avec `toMatchObject`.
- Un `beforeEach` pose le chemin nominal, chaque test ne surcharge que la condition qu'il isole.
- Vérifier qu'un test attrape vraiment quelque chose : réintroduire le bug, confirmer que les tests attendus échouent, puis restaurer.

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
