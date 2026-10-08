# Sessions backend — dettes et conception

Reco du module `apps/api/src/sessions/` faite le 2026-07-31. Les décisions elles-mêmes sont dans `docs/DECISIONS.md` ; ce fichier garde le détail.

À traiter après l'écran Session mobile, dans cet ordre : rattachement implicite (change un contrat), puis index partiel (migration SQL manuelle), puis zombies.

## 1. Rattachement implicite de `sessionId`

- Aujourd'hui `AscentsService.create` fait `sessionId: dto.sessionId ?? null` : aucune résolution implicite.
- Cible : si `sessionId` est absent, le service résout la session active de l'utilisateur. `sessionId: null` explicite reste l'échappatoire pour logger hors session.
- Change le contrat de `POST /ascents` en place : à discuter avant de coder. Impacte le flow « log ascent » de l'écran boulder detail.

## 2. Index partiel unique

- Seul le `findFirst({ endedAt: null })` de `startSession` tient l'invariant : fenêtre TOCTOU (double tap sur Start, retry réseau).
- Prisma ne sait pas exprimer un index partiel : migration SQL manuelle.

```sql
CREATE UNIQUE INDEX board_sessions_one_active_per_user
  ON board_sessions (user_id)
  WHERE ended_at IS NULL;
```

- Les deux gardes se complètent : le check donne le 409 lisible, l'index garantit.
- Un test e2e (deux `POST /sessions` d'affilée) est le seul moyen de le prouver : voir `docs/notes/api-tests.md`.

## 3. Sessions zombies

- Découvert en test le 2026-09-29 : une session ouverte le 2026-07-31 était restée active deux mois et bloquait tout nouveau Start.
- Décision : fermeture automatique côté serveur au-delà d'environ 6 h, plutôt qu'une invite dans l'app ou le statu quo.
- À concevoir : cron ou fermeture paresseuse (à la lecture, au Start), et la valeur de `endedAt` posée.

## Piège Prisma rencontré

`select` et `include` sont mutuellement exclusifs à un même niveau, et la contrainte n'est vérifiée qu'à l'exécution : `tsc` laisse passer le mélange. Une relation se demande dans le `select`. Un `include` sur une relation renvoie déjà tous les scalaires du modèle.
