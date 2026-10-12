# Inclinaison d'un bloc — conception

Discuté et décidé le 2026-10-12. Les décisions sont dans `docs/DECISIONS.md` ; ce fichier garde le raisonnement et le découpage. Rien n'est implémenté.

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
- À l'ouverture : la dernière inclinaison choisie par l'utilisateur (sa board y est probablement encore), sinon celle du filtre d'Explore, sinon celle du créateur.
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

Relation N-N entre `Boulder` et `Angle`, portée par une table :

`boulder_angle_grades` : `boulder_id`, `angle_id`, `grade_id` (cotation effective), `votes_count`. Unique sur (`boulder_id`, `angle_id`).

- À la création d'un bloc : une seule ligne, pour l'inclinaison du créateur, avec sa cotation et 0 vote.
- Aux autres inclinaisons : aucune ligne tant que personne n'a voté. La ligne est créée au premier vote.
- À chaque vote : médiane recalculée et ligne mise à jour dans la même transaction que l'ascension.
- « Estimée » ne se stocke pas : c'est `votes_count < 5` sur une inclinaison qui n'est pas celle du créateur.

La table est un résultat précalculé, pas une information nouvelle : la médiane se déduit des ascensions. Elle existe pour Explore, qui filtre et trie par cotation et ne peut pas recalculer la médiane de tous les blocs à chaque affichage.

`ascents` reçoit une colonne d'inclinaison. Migration : les ascensions existantes prennent l'inclinaison du créateur de leur bloc.

## Découpage de `feature/boulder-angle`

1. Inclinaison sur l'ascension, règles par inclinaison, sélecteur dans l'en-tête. La cotation affichée est celle du créateur à son inclinaison, « pas encore cotée » ailleurs. Pas besoin de `boulder_angle_grades` à cette étape.
2. Cotation communautaire : la table, la médiane, le seuil, l'affichage.
3. Explore : filtre et tri sur la cotation effective.

## Questions ouvertes

- Explore : un bloc apparaît-il à toutes les inclinaisons, sans cotation là où personne n'a voté, ou seulement là où il est coté ? L'inclinaison de création reste dans tous les cas la référence du bloc.
- Session : le compte rendu d'une séance doit-il afficher l'inclinaison de chaque passage ?
- Naissance de la ligne `boulder_angle_grades` aux inclinaisons autres que celle du créateur. Deux options à comparer avant l'étape 2 :
  - au premier vote (proposition de l'agent) : la cotation n'est jamais vide, mais un projet ouvert à cette inclinaison n'a pas de ligne ;
  - au premier essai (proposition de Seb) : la ligne existe dès qu'on y touche, avec 0 vote et une cotation vide, et l'ascension pourrait s'y rattacher directement au lieu de porter `boulder_id` et l'inclinaison. Coût : une cotation nullable, et une jointure de plus pour « mes ascensions sur ce bloc ».
- Playlists : une playlist reste une liste de blocs sans inclinaison (décidé le 2026-10-12). Une fois l'inclinaison en place, un sélecteur unique pour toute la playlist est une piste, puisqu'on ne change pas l'inclinaison de la board en cours de playlist.
