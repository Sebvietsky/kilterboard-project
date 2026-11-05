-- Inclinaison de l'ascension.
--
-- Généré par Prisma puis complété à la main : Prisma ajoutait la colonne
-- directement en NOT NULL, ce qui échoue sur une table déjà remplie. Une
-- migration de données ne s'exprime pas dans le schéma, d'où les trois temps.

-- 1. Colonne nullable, le temps de la remplir.
ALTER TABLE "ascents" ADD COLUMN "angle_id" INTEGER;

-- 2. Les ascensions existantes prennent l'inclinaison du créateur de leur bloc :
--    c'était la seule que l'app proposait jusqu'ici.
UPDATE "ascents" AS a
SET "angle_id" = b."angle_id"
FROM "boulders" AS b
WHERE a."boulder_id" = b."id";

-- 3. Obligatoire désormais.
ALTER TABLE "ascents" ALTER COLUMN "angle_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ascents" ADD CONSTRAINT "ascents_angle_id_fkey" FOREIGN KEY ("angle_id") REFERENCES "angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
