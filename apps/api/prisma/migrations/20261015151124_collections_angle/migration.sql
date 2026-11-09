-- Inclinaison des favoris et des entrées de playlist.
--
-- Généré par `prisma migrate diff` puis complété à la main : Prisma ajoutait la
-- colonne directement en NOT NULL, ce qui échoue sur une table déjà remplie.
-- L'inclinaison entre dans la clé primaire : le même bloc à deux inclinaisons
-- fait deux favoris, ou deux entrées dans une playlist.

-- 1. Colonnes nullables, le temps de les remplir.
ALTER TABLE "boulder_likes" ADD COLUMN "angle_id" INTEGER;
ALTER TABLE "playlist_boulders" ADD COLUMN "angle_id" INTEGER;

-- 2. Les lignes existantes prennent l'inclinaison du créateur de leur bloc :
--    c'est celle à laquelle l'app ouvrait le bloc jusqu'ici.
UPDATE "boulder_likes" AS l
SET "angle_id" = b."angle_id"
FROM "boulders" AS b
WHERE l."boulder_id" = b."id";

UPDATE "playlist_boulders" AS pb
SET "angle_id" = b."angle_id"
FROM "boulders" AS b
WHERE pb."boulder_id" = b."id";

-- 3. Obligatoires désormais, et dans la clé primaire.
ALTER TABLE "boulder_likes" ALTER COLUMN "angle_id" SET NOT NULL;
ALTER TABLE "playlist_boulders" ALTER COLUMN "angle_id" SET NOT NULL;

ALTER TABLE "boulder_likes" DROP CONSTRAINT "boulder_likes_pkey",
ADD CONSTRAINT "boulder_likes_pkey" PRIMARY KEY ("user_id", "boulder_id", "angle_id");

ALTER TABLE "playlist_boulders" DROP CONSTRAINT "playlist_boulders_pkey",
ADD CONSTRAINT "playlist_boulders_pkey" PRIMARY KEY ("boulder_id", "playlist_id", "angle_id");

-- AddForeignKey
ALTER TABLE "playlist_boulders" ADD CONSTRAINT "playlist_boulders_angle_id_fkey" FOREIGN KEY ("angle_id") REFERENCES "angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boulder_likes" ADD CONSTRAINT "boulder_likes_angle_id_fkey" FOREIGN KEY ("angle_id") REFERENCES "angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
