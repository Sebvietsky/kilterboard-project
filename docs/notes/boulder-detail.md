# Boulder detail — design cible et backlog

Écran `apps/mobile/app/boulder/[id].tsx`. MVP fusionné le 2026-07-29 (#36), cycle de vie des projets le 2026-07-30 (#47).

## Design cible

Validé par Seb sur maquettes (2026-07-24, « Midnight Sun / Kilter Board »). Reproduire l'agencement, pas les couleurs : garder notre DA (tokens de `constants/theme.ts`).

**Header**
- Nom du bloc à gauche (+ badge de statut / cœur favori à côté).
- Cote et angle à droite, sur la même ligne que le nom (cote proéminente en couleur primaire, ex. `V7 / 7A+` ; angle `45°`). Ne pas les empiler sous le nom.
- Setter (`by X`) en dessous.

**Board LED**
- État actuel : placeholder, grille schématique 12×12 (`components/BoardLED.tsx`), prises en anneaux colorés par rôle. Mapping correct (START en bas, FINISH en haut).
- Cible : rendu réaliste, layout réel des prises avec celles du bloc allumées sur fond sombre. Tâche séparée : il faut le dataset des coordonnées réelles (voir `docs/notes/ble-reprise.md`). Couleurs = `theme.holds`.

**Stats card** (fond `surface` + `shadows.card`) : `RATING ★` | `ASCENTS` | `TAGS` (chips).

**Formulaire de log**
- Segmented control Flash / Sent / Project, options dérivées de l'historique.
- Felt Grade : picker horizontal de cotations (label `REQUIRED` quand obligatoire), source `GET /grades`, on envoie le `rank`.
- Notes : textarea + toggle public / privé.
- Pas de second formulaire pour la gestion d'un projet : celui du log est généralisé par conditions.

**Community** : cible = avatar, nom, badge `Vx FELT`, nombre d'essais, likes, date, tri, « View All ». Une section « Community notes » simple existe déjà.

## Pas encore fait

- Rendu réaliste du board.
- Bouton « Display on Board » (Bluetooth) : dépend du chantier BLE.
- Bouton « Add to Playlist ».
- Version complète de la section Community (likes, tri, « View All »).

## Backlog (choix de périmètre assumés)

- **Stats agrégées backend** : taux de flash (`flashCount / ascentCount`) et cote moyenne proposée (moyenne des `feltGrade`) ne sont pas exposés par `GET /boulders/:id`. Ajouter un agrégat (`GET /boulders/:id/stats` ou champs calculés). Même prérequis que le taux de flash du profil.
- **Note privée de séance** : masquée en mode In Project, parce qu'aucun écran ne la relit. À réactiver le jour où un écran montrera l'historique du projet.
- **REPEAT** (hors MVP, tranché le 2026-07-30) : absent du mobile, et aucune règle de `create` ne le mentionne. Un `POST { status: REPEAT }` sur un bloc jamais envoyé passe toutes les gardes et reçoit une `sendDate`. Règle manquante, symétrique de celle du flash : un REPEAT exige un SENT ou FLASH antérieur sur ce bloc. Chantier back + front + segments du formulaire.

## Décisions de conception du cycle de vie des projets

- `sessionsCount Int @default(1)` sur `Ascent` : un compteur, pas de table par séance. Les maquettes n'affichent qu'un total.
- `UpdateAscentDto.attemptsToAdd` = essais de cette séance. Le serveur additionne par `{ increment }` : le total ne peut que croître, et deux appareils simultanés s'additionnent au lieu de s'écraser.
- Pas de `...dto` dans `update()` : `attemptsToAdd` et `feltGradeRank` ne sont pas des colonnes, et `tsc` ne voit pas l'erreur.
- Un projet actif ne bloque rien : `deriveAvailableStatuses` renvoie `['PROJECT']`, pas `[]`.
