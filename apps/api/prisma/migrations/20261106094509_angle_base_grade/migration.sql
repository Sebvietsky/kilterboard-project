-- AlterTable
ALTER TABLE "boulder_angles" ADD COLUMN     "base_grade_id" INTEGER;

-- AddForeignKey
ALTER TABLE "boulder_angles" ADD CONSTRAINT "boulder_angles_base_grade_id_fkey" FOREIGN KEY ("base_grade_id") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Données : la cotation de départ des blocs existants est celle du créateur,
-- à son inclinaison. Les autres inclinaisons n'en ont pas.
UPDATE "boulder_angles" AS ba
SET "base_grade_id" = b."grade_id"
FROM "boulders" AS b
WHERE ba."boulder_id" = b."id" AND ba."angle_id" = b."angle_id";
