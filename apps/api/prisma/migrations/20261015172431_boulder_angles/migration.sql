-- Un bloc à une inclinaison : table `boulder_angles`, une ligne par bloc et par
-- inclinaison, et clés étrangères composées depuis les ascensions, les favoris
-- et les entrées de playlist.
--
-- Généré par `prisma migrate diff` puis complété à la main : le remplissage
-- (étape 2) doit précéder les clés composées, que les lignes existantes
-- violeraient sinon.

-- 1. La table.
CREATE TABLE "boulder_angles" (
    "boulder_id" INTEGER NOT NULL,
    "angle_id" INTEGER NOT NULL,
    "grade_id" INTEGER,
    "votes_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "boulder_angles_pkey" PRIMARY KEY ("boulder_id","angle_id")
);

ALTER TABLE "boulder_angles" ADD CONSTRAINT "boulder_angles_boulder_id_fkey" FOREIGN KEY ("boulder_id") REFERENCES "boulders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "boulder_angles" ADD CONSTRAINT "boulder_angles_angle_id_fkey" FOREIGN KEY ("angle_id") REFERENCES "angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boulder_angles" ADD CONSTRAINT "boulder_angles_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Une ligne par bloc et par inclinaison. Celle du créateur reçoit sa
--    cotation, les autres n'en ont pas. Aucun vote compté ici : les votes
--    existants sont recalculés ensuite par le code de l'API, pour que la règle
--    de la médiane ne vive qu'à un seul endroit.
INSERT INTO "boulder_angles" ("boulder_id", "angle_id", "grade_id")
SELECT b."id",
       a."id",
       CASE WHEN a."id" = b."angle_id" THEN b."grade_id" END
FROM "boulders" AS b
CROSS JOIN "angles" AS a;

-- 3. Les clés composées : toute ascension, tout favori et toute entrée de
--    playlist désigne désormais une ligne existante.
ALTER TABLE "ascents" ADD CONSTRAINT "ascents_boulder_id_angle_id_fkey" FOREIGN KEY ("boulder_id", "angle_id") REFERENCES "boulder_angles"("boulder_id", "angle_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_boulders" ADD CONSTRAINT "playlist_boulders_boulder_id_angle_id_fkey" FOREIGN KEY ("boulder_id", "angle_id") REFERENCES "boulder_angles"("boulder_id", "angle_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "boulder_likes" ADD CONSTRAINT "boulder_likes_boulder_id_angle_id_fkey" FOREIGN KEY ("boulder_id", "angle_id") REFERENCES "boulder_angles"("boulder_id", "angle_id") ON DELETE CASCADE ON UPDATE CASCADE;
