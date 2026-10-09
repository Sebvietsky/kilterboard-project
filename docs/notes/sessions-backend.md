# Sessions backend — dettes et conception

Reco du module `apps/api/src/sessions/` faite le 2026-07-31. Les décisions elles-mêmes sont dans `docs/DECISIONS.md` ; ce fichier garde le détail.

Ordre : index partiel (fait le 2026-10-08, PR #54), puis rattachement implicite (change un contrat, à faire avant la liste des blocs de l'écran), puis zombies.

## 1. Rattachement implicite de `sessionId`

- Aujourd'hui `AscentsService.create` fait `sessionId: dto.sessionId ?? null` : aucune résolution implicite.
- Cible : si `sessionId` est absent, le service résout la session active de l'utilisateur. `sessionId: null` explicite reste l'échappatoire pour logger hors session.
- Change le contrat de `POST /ascents` en place : à discuter avant de coder. Impacte le flow « log ascent » de l'écran boulder detail.

## 2. Index partiel unique — fait le 2026-10-08 (PR #54)

- Le `findFirst({ endedAt: null })` de `startSession` laissait une fenêtre TOCTOU (double tap sur Start, retry réseau).
- Prisma 7.8 sait l'exprimer avec la preview feature `partialIndexes` : `@@unique([userId], where: { endedAt: null }, map: "board_sessions_one_active_per_user")`. La migration est générée par Prisma, pas écrite à la main.
- Les deux gardes se complètent : le check donne le 409 lisible, l'index garantit. Si l'index rejette, `PrismaExceptionFilter` traduit la `P2002` en 409 générique.
- Prouvé par insertions SQL directes (seconde session active refusée). Un test unitaire couvre la remontée de la `P2002`. Deux `POST /sessions` réellement simultanés restent à couvrir en e2e : voir `docs/notes/api-tests.md`.

## 3. Sessions zombies

- Découvert en test le 2026-09-29 : une session ouverte le 2026-07-31 était restée active deux mois et bloquait tout nouveau Start.
- Décision : fermeture automatique côté serveur au-delà d'environ 6 h, plutôt qu'une invite dans l'app ou le statu quo.
- À concevoir : cron ou fermeture paresseuse (à la lecture, au Start), et la valeur de `endedAt` posée.

## Piège Prisma rencontré

`select` et `include` sont mutuellement exclusifs à un même niveau, et la contrainte n'est vérifiée qu'à l'exécution : `tsc` laisse passer le mélange. Une relation se demande dans le `select`. Un `include` sur une relation renvoie déjà tous les scalaires du modèle.
