-- AlterTable
ALTER TABLE "boulder_angles" ADD COLUMN     "kilter_ascensionists" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "boulder_angles_angle_id_kilter_ascensionists_idx" ON "boulder_angles"("angle_id", "kilter_ascensionists" DESC);


-- Données : la clé de tri reprend le nombre de grimpeurs Kilter des blocs
-- déjà importés. Les autres lignes gardent 0.
UPDATE "boulder_angles" AS ba
SET "kilter_ascensionists" = s."ascensionist_count"
FROM "kilter_angle_stats" AS s
WHERE ba."boulder_id" = s."boulder_id" AND ba."angle_id" = s."angle_id";
