# Données Kilter — source et faits vérifiés

Relevé le 2026-10-19 sur le catalogue boardsesh du 2026-10-17. Remplace BoardLib comme source, cité dans `docs/ble-protocol.md` et `ble-reprise.md`.

## Source

- Aurora a fermé le backend Kilter en mars 2026 : la synchronisation de BoardLib ne fonctionne plus. La nouvelle API Kilter est réservée aux comptes autorisés et ses conditions interdisent le scraping.
- Source retenue : les snapshots publics de boardsesh (Apache-2.0 ; leur `LEGAL.md` invite à les utiliser). Doc : `docs/board-snapshots-dataset.md` du dépôt `boardsesh/boardsesh`.
  - Matériel (trous, placements, LED, rôles, tailles) : `https://snapshots.boardsesh.com/board-snapshots/v1-catalog/manifest.json`, un fichier pour toutes les boards (35 Mo compressés, 194 Mo décompressés).
  - Blocs : `https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json`, un fichier par (board, layout). Kilter Original = layout 1 : 82 Mo, 384 775 blocs.
  - Ne jamais coder une URL d'artefact en dur : les artefacts sont horodatés et supprimés après 14 jours. Toujours passer par le manifeste.
- Usage personnel, non commercial. Le dépôt étant public : aucune base commitée, un script de téléchargement à la place. Pas de photo de la board (Kilter, LLC revendique un copyright dessus) : le plan des prises est dessiné par l'app à partir des coordonnées.

## Kilter Original (product 1, layout 1)

| Taille (`board_product_sizes`) | id | LED |
| --- | --- | --- |
| 7 x 10 (Small) | 14 | 225 |
| 8 x 12 (Home) | 8 | 311 |
| 12 x 12 with kickboard | 10 | 476 |
| 12 x 12 without kickboard | 27 | 441 |
| 12 x 14 (Commercial) | 7 | 527 |
| 16 x 12 (Super Wide) | 28 | 641 |

- Deux jeux de prises, proposés pour toutes les tailles : Bolt Ons (set 1, 488 placements) et Screw Ons (set 20, 204 placements).
- 692 trous (`board_holes`), coordonnées x de -20 à 164 et y de 4 à 176. Une taille est un rectangle (`edge_*`) sur cette grille commune.
- **La position LED d'un trou dépend de la taille** (`board_leds` : `product_size_id`, `hole_id`, `position`). Entre 12 x 12 avec et sans kickboard, aucun trou commun n'a la même position. Une mauvaise taille allume les mauvaises prises : la taille exacte de la board est un prérequis du BLE.
- Rôles (`board_placement_roles`, product 1) : start `00FF00`, middle `00FFFF`, finish `FF00FF`, foot `FFA500`.

## Cotations (`board_difficulty_grades`)

- Une ligne par cotation Font, filtrer sur `board_type = 'kilter'`. `boulder_name` vaut « 6a/V3 » : Font puis V. Le V est plus grossier (6a et 6a+ sont V3, 7b et 7b+ sont V8).
- Lignes listées (`is_listed = 1`) : `difficulty` 10 (4a/V0) à 33 (8c+/V16). Les autres (1a à 3c, 9a et plus) ne s'affichent pas dans l'app Kilter.
- Notre table `grades` les reprend telles quelles depuis le 2026-10-21 : `rank` = `difficulty`, une ligne par Font, V non unique (`prisma/seed.ts`, `apps/mobile/lib/grades/scale.ts`). À l'import, la cotation d'un bloc (`display_difficulty`, décimale) s'arrondit au rang le plus proche.

## Schéma utile

- `board_holes` : id, product_id, name, x, y, mirrored_hole_id
- `board_placements` : id, layout_id, hole_id, set_id, default_placement_role_id
- `board_leds` : id, product_size_id, hole_id, position
- `board_placement_roles` : id, product_id, position, name, led_color, screen_color
- `board_product_sizes` : id, product_id, name, edge_left/right/bottom/top
- Blocs (fichier séparé) : `board_climbs` (uuid, name, setter_username, angle, `frames`, is_listed, required_set_ids, compatible_size_ids…), `board_climb_stats` par (bloc, inclinaison).

## Blocs (`board_climbs`, `board_climb_stats`), relevé le 2026-11-06

Snapshot du 2026-11-05, Kilter Original (layout 1) : 388 554 blocs, 378 658 lignes de statistiques. Import : `prisma/import-climbs.ts` (`db:import-climbs`).

- **Prises** : `frames` = suite de `p<placement>r<rôle>` (`p1091r15p1131r12…`), placements de `board_placements`. Rôles du product 1 : 12 start, 13 middle (main), 14 finish, 15 foot. Quelques blocs utilisent d'autres rôles (20, 23…) : écartés.
- `frames_count` > 1 : blocs animés (une centaine), écartés.
- `compatible_size_ids` : JSON (`[7,10,16]`). 288 790 blocs publiés vont sur la taille 10 ; sur 3 000 testés, toutes leurs prises existent dans `holds` et ont une LED à la taille 10.
- **Statistiques par inclinaison**, de 0 à 70° : `display_difficulty` (décimale, sur l'échelle des rangs 10 à 33), `ascensionist_count`, `quality_average`, `benchmark_difficulty` (non nul = benchmark). 40° concentre l'essentiel des ascensions.
- `board_climbs.angle` (inclinaison du setter) est nul pour 116 185 blocs.
- Volume selon le nombre de grimpeurs à une inclinaison ≥ 20° : ≥ 1 → 134 833 blocs, ≥ 5 → 54 139, ≥ 20 → 16 925, ≥ 100 → 5 407.
- **Import (décisions du 2026-11-06)** : ≥ 20 grimpeurs ; inclinaisons 20 à 70° seulement ; créateur = compte système `kilter`, pseudo dans `boulders.setter_name` ; cotation de départ à chaque inclinaison cotée (`boulder_angles.base_grade_id`, `display_difficulty` arrondi) ; statistiques brutes dans `kilter_angle_stats` ; inclinaison de référence = celle du setter si elle est cotée, sinon la plus grimpée. Résultat : 16 301 blocs, 300 écartés (taille 221, prise ou rôle inconnu 77, prise en double 1, sans cotation 1), en 20 s.

## Encore à faire

- ~~Identifier la taille exacte de la board de Seb.~~ **Confirmée le 2026-10-23 : 12 x 12 with kickboard (id 10, 476 LED)**, par l'essai BLE en salle (motif des 4 coins et du centre, `docs/notes/ble-essai-salle.md`).
- ~~Lire le format de `frames` sur des blocs réels.~~ Fait le 2026-11-06 (ci-dessus).
- ~~Concevoir la correspondance avec notre modèle.~~ Faite le 2026-11-06 (ci-dessus).
