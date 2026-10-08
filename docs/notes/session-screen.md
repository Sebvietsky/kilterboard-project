# Écran Session — notes de travail

Les décisions sont dans `docs/DECISIONS.md` ; ce fichier garde le détail utile pour coder l'écran.

## JSON réels de l'API (capturés le 2026-10-08, `test_user_0`)

`POST /sessions` (start, 201) et `PATCH /sessions/:id/end` (200) renvoient la même forme :

```json
{
  "id": 8,
  "userId": 2,
  "boardId": null,
  "title": "Session du 08/10/2026",
  "note": null,
  "startedAt": "2026-10-08T16:03:13.378Z",
  "endedAt": null,
  "isShared": false,
  "createdAt": "2026-10-08T16:03:13.378Z"
}
```

Après End, `endedAt` vaut une date ISO (`"2026-10-08T16:03:13.474Z"`).

`GET /sessions/active` (200) renvoie les mêmes champs, plus `board` et `ascents` :

```json
{
  "board": null,
  "ascents": []
}
```

Sans session active : 200 avec un corps vide, que `api.getOrNull` traduit en `null`.

## Forme de `board` et `ascents` quand ils sont remplis

Non capturée en réel (aucune ascension n'est rattachée à une session tant que le rattachement implicite n'est pas fait). Déduite du `select` de `getActiveSession` dans `apps/api/src/sessions/sessions.service.ts` ; les valeurs sont illustratives.

```json
{
  "board": { "name": "…", "gymName": null },
  "ascents": [
    {
      "id": 138,
      "status": "SENT",
      "boulderId": 3,
      "createdAt": "2026-10-08T15:20:59.353Z",
      "attemptsCount": 3,
      "boulder": {
        "name": "…",
        "grade": { "vScale": "V3", "fontScale": "6a/+", "rank": 5 },
        "angle": { "valueDegrees": 40 }
      }
    }
  ]
}
```

- Les ascensions sont triées par `createdAt` décroissant.
- La forme de `boulder` est la même que dans `MyProject` (`apps/mobile/lib/ascents/types.ts`).
- `board.name` est obligatoire, `board.gymName` est nullable (`String?` dans le model `Board`).

## Types à écrire (`apps/mobile/lib/sessions/types.ts`)

- `Session` : les neuf champs de la première réponse.
- `ActiveSession` : `Session` + `board` + `ascents` (combinaison par `&`, comme `LogAscentInput`).
- `status` réutilise `AscentStatus`.
