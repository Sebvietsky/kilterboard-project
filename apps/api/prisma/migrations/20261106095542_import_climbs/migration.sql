-- AlterTable
ALTER TABLE "boulders" ADD COLUMN     "kilter_uuid" VARCHAR(64),
ADD COLUMN     "setter_name" VARCHAR(100);

-- CreateTable
CREATE TABLE "kilter_angle_stats" (
    "boulder_id" INTEGER NOT NULL,
    "angle_id" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "ascensionist_count" INTEGER NOT NULL,
    "quality_average" DOUBLE PRECISION,
    "is_benchmark" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kilter_angle_stats_pkey" PRIMARY KEY ("boulder_id","angle_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boulders_kilter_uuid_key" ON "boulders"("kilter_uuid");

-- AddForeignKey
ALTER TABLE "kilter_angle_stats" ADD CONSTRAINT "kilter_angle_stats_boulder_id_angle_id_fkey" FOREIGN KEY ("boulder_id", "angle_id") REFERENCES "boulder_angles"("boulder_id", "angle_id") ON DELETE CASCADE ON UPDATE CASCADE;

