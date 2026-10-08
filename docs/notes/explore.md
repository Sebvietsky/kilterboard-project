# Explore — pastille de statut (hors MVP) et pièges

Écran `apps/mobile/app/(tabs)/explore.tsx`. Filtres actifs et header collapsible fusionnés le 2026-07-29 (#38).

## Pastille de statut sur les cartes — reportée hors MVP le 2026-07-30

Ne pas la relancer sans que Seb le demande. Conception faite, à reprendre telle quelle.

- **Auth optionnelle sur `GET /boulders`** (route publique aujourd'hui, comme `findOne` et `/comments`). `OptionalJwtAuthGuard extends JwtAuthGuard` : pas de header `Authorization` → `true` sans `request.user` ; header présent mais token invalide → 401 (un token envoyé est une affirmation explicite). Suppose de passer `extractTokenFromHeader` de `private` à `protected`.
- **Quel statut gagne** quand l'utilisateur a plusieurs ascensions sur un bloc : la plus ancienne. La complétion d'un projet se fait par PATCH sur la même ligne, donc « PROJECT ⇒ SENT » tombe tout seul, et un REPEAT ne peut jamais gagner. Aucune table de priorité. Implémentation : `orderBy: { createdAt: 'asc' }` et n'écrire dans la Map que si la clé est absente.
- **Chargement** : pas d'`include` dans le `findMany`. Reprendre le pattern d'`averageRating` de `boulders.service.ts` (requête séparée sur les `boulderIds` de la page + Map) et court-circuiter si `userId` est `undefined`.
- **Piège** : `BoulderDetailDto extends BoulderSummaryDto`, donc ajouter `userStatus` au summary oblige `findOne` à le remplir ou à casser l'héritage.

## Ce qui est en place

- `components/filters/ActiveFilters.tsx` : une chip supprimable par filtre + « Clear all » au-delà d'un filtre. Lit et écrit `useFiltersStore` directement. La recherche par nom n'y figure pas, son champ la montre déjà.
- Header : seul le grand titre se replie au scroll. Recherche, Filters et chips restent fixes hors de la `FlatList`, parce que ce sont des actions primaires.
- `TAGS`, `GRADE_MIN_RANK` / `GRADE_MAX_RANK`, `gradeLabel()` et `tagLabel()` vivent dans `lib/filters/const.ts`, source unique.

## Pièges à ne pas réintroduire

- Un `ScrollView` horizontal dans un conteneur en colonne s'étire et pousse la liste hors écran : d'où le `flexGrow: 0` dans `ActiveFilters`.
- `useRef(new Animated.Value(0)).current` est refusé par la règle `react-hooks/refs`. Utiliser `useState(() => new Animated.Value(0))`.
