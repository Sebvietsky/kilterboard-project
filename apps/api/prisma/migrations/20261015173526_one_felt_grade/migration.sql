-- Un seul grade ressenti par grimpeur, par bloc et par inclinaison : c'est son
-- vote pour la cotation. L'API exigeait un grade au premier envoi sans le
-- refuser ensuite, d'où des grades en double (envois suivants, REPEAT du seed).
--
-- Généré par `prisma migrate diff` puis complété à la main : le nettoyage
-- (étape 1) doit précéder l'index, que les doublons violeraient sinon.

-- 1. On garde, pour chaque (grimpeur, bloc, inclinaison), le grade du premier
--    envoi (SENT ou FLASH) qui en porte un. Tous les autres sont effacés :
--    envois suivants, REPEAT et projets. Seul le grade ressenti est retiré,
--    l'ascension reste.
UPDATE "ascents" AS a
SET "felt_grade_id" = NULL
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "user_id", "boulder_id", "angle_id"
           ORDER BY ("status" IN ('SENT', 'FLASH') AND "felt_grade_id" IS NOT NULL) DESC,
                    "created_at", "id"
         ) AS rn,
         ("status" IN ('SENT', 'FLASH')) AS is_send
  FROM "ascents"
) AS ranked
WHERE a."id" = ranked."id"
  AND a."felt_grade_id" IS NOT NULL
  AND NOT (ranked.rn = 1 AND ranked.is_send);

-- 2. L'index garantit la règle en base, quel que soit le client.
CREATE UNIQUE INDEX "ascents_one_felt_grade_per_user_boulder_angle" ON "ascents"("user_id", "boulder_id", "angle_id") WHERE ("felt_grade_id" IS NOT NULL);
