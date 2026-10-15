# Inclinaison d'un bloc — conception

Discuté et décidé le 2026-10-12, complété le 2026-10-15. Les décisions sont dans `docs/DECISIONS.md` ; ce fichier garde le raisonnement et le découpage. Étape 1 faite (#66), étape 2 faite (#70).

## Le besoin

Sur une Kilterboard, l'inclinaison se règle. Le même bloc se grimpe à plusieurs inclinaisons, et sa difficulté change beaucoup de l'une à l'autre. Aujourd'hui un bloc porte une seule paire inclinaison / cotation, celle de son créateur, et une ascension ne retient pas l'inclinaison à laquelle elle a été faite.

## Règle métier centrale

Un envoi à 60° et un envoi à 55° du même bloc sont deux réussites distinctes. Toutes les règles « par bloc » deviennent « par bloc et par inclinaison » :

- un flash possible à chaque inclinaison ;
- un projet ouvert par inclinaison ;
- le grade ressenti demandé au premier envoi de chaque inclinaison ;
- « déjà envoyé » dépend de l'inclinaison affichée (`deriveAvailableStatuses` côté mobile).

## Sélecteur d'inclinaison

- Dans l'en-tête du détail d'un bloc : l'inclinaison seule (« 60° »), cliquable. La cotation reste dans l'écran.
- Choix local à l'écran. Il ne modifie jamais le filtre d'Explore, que le filtre soit vide ou déjà posé sur une inclinaison.
- À l'ouverture : l'inclinaison du lien, c'est-à-dire du contexte d'où l'on vient (carte d'Explore, ascension d'un projet ou d'un passage, et à terme favori ou entrée de playlist), sinon celle du créateur. Écarté le 2026-10-15 : « la dernière inclinaison choisie », qui demandait un état global et contredisait le contexte du lien.
- Écarté : un réglage global « inclinaison de ma board » avec avertissement quand on en sort. Trop lourd, et sans BLE l'app ne connaît pas l'inclinaison réelle.

## Cotation par inclinaison

- Un vote = le grade ressenti donné au premier envoi. Une personne vote donc une fois par bloc et par inclinaison.
- Inclinaison du créateur : sa cotation s'affiche jusqu'à 5 votes, puis la médiane des votes la remplace.
- Autre inclinaison : pas de cotation tant que personne n'a voté ; « estimée » de 1 à 4 votes ; médiane normale à partir de 5.
- Médiane et non majorité : avec des votes répartis 4 / 3 / 3 la majorité bascule sur un seul vote, et les égalités n'ont pas de réponse.
- Seuil de 5 et non 10 : les votes sont fragmentés par inclinaison et un vote est rare. Une médiane sur 5 résiste encore à deux avis aberrants. À porter par une constante nommée.
- La cotation du créateur reste sur `boulders` comme référence. À l'écran : la cotation effective seule, celle du créateur en petit seulement si elle diffère (« Set as V5 · 7 votes »). À retirer si ça charge trop l'écran.
- Message neutre à la saisie du grade ressenti, du type « Your felt grade counts toward the community grade ». Pas de « be careful », qui pousserait à s'aligner sur la cotation affichée.

Scénarios écartés pour le passage du seuil : le créateur compte comme un vote (sans effet avec une médiane), le créateur pèse plusieurs votes (difficile à expliquer, ne couvre pas le cas sans cotation de départ), deux cotations côte à côte (il faut de toute façon en choisir une pour filtrer et trier).

## Modèle de données

`boulder_angles` : `boulder_id`, `angle_id` (clé primaire), `grade_id` (cotation effective, nullable), `votes_count`.

- Une ligne par inclinaison de la table `angles`, toutes créées avec le bloc (seeds : `ensureBoulderAngles`). Ajouter une inclinaison demande de compléter les lignes.
- `ascents`, `boulder_likes` et `playlist_boulders` y pointent par la clé étrangère composée `(boulder_id, angle_id)`.
- Recalcul à chaque vote (`apps/api/src/boulders/community-grade.ts`), dans la transaction de l'ascension, avec verrou de ligne. Recalcul complet : `db:recompute-grades`.
- « Estimée » ne se stocke pas : c'est `votes_count < 5` sur une inclinaison qui n'est pas celle du créateur.
- Un vote = le grade ressenti du premier envoi, un par grimpeur, bloc et inclinaison (index partiel `ascents_one_felt_grade_per_user_boulder_angle`). Médiane basse pour un nombre pair de votes.

La cotation stockée est un résultat précalculé, pas une information nouvelle : la médiane se déduit des ascensions. Elle est stockée pour Explore, qui filtre et trie par cotation et ne peut pas recalculer la médiane de tous les blocs à chaque affichage.

Choix du 2026-10-15, sur deux axes indépendants :

1. La liaison entre une ascension (ou un like, une entrée) et la ligne : aucune (A), clé étrangère composée (B), id propre `boulder_angle_id` (C).
2. La naissance de la ligne : au premier vote, à la première action, ou avec le bloc (D).

B impose que la ligne existe avant tout like ou toute ascension, d'où D. B + D retenu plutôt que C + D : même résultat pour l'utilisateur et même contrat d'API, pour une fraction de la migration (C réécrivait une trentaine de requêtes dans cinq services). C'est aussi la traduction directe du MCD : une association BOULDER–ANGLE porteuse de propriétés, identifiée par ses deux clés. A écarté : un bloc créé à une autre inclinaison et jamais voté y restait introuvable dans Explore.

## Découpage de `feature/boulder-angle`

1. Inclinaison sur l'ascension, règles par inclinaison, sélecteur dans l'en-tête. La cotation affichée est celle du créateur à son inclinaison, « pas encore cotée » ailleurs. Pas besoin de `boulder_angle_grades` à cette étape.
2. ✅ Cotation communautaire (#70) : la table, la médiane, le seuil, l'affichage.
3. Explore : filtre et tri sur la cotation effective.

## Questions ouvertes

- Explore filtré à une inclinaison : envois seulement (décidé le 2026-10-15) ; un bloc y apparaît s'il y est coté. Sans filtre : forme à choisir à l'étape 3.
- Statistiques du bloc (ascensions, note) par inclinaison : pas encore faites.
