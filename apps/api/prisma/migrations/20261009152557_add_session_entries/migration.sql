-- CreateTable
CREATE TABLE "session_entries" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "ascent_id" INTEGER NOT NULL,
    "status" "AscentStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_entries_session_id_created_at_idx" ON "session_entries"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "session_entries_ascent_id_idx" ON "session_entries"("ascent_id");

-- AddForeignKey
ALTER TABLE "session_entries" ADD CONSTRAINT "session_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "board_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_entries" ADD CONSTRAINT "session_entries_ascent_id_fkey" FOREIGN KEY ("ascent_id") REFERENCES "ascents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des données, seule partie écrite à la main : Prisma génère le
-- schéma, pas le déplacement des lignes. Chaque ascension déjà rattachée à une
-- session devient un passage. Placée AVANT la suppression de la colonne, que
-- Prisma émet en premier — d'où le réordonnancement de ce fichier.
INSERT INTO "session_entries" ("session_id", "ascent_id", "status", "attempts", "created_at")
SELECT "session_id", "id", "status", "attempts_count", "created_at"
FROM "ascents"
WHERE "session_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ascents" DROP CONSTRAINT "ascents_session_id_fkey";

-- AlterTable
ALTER TABLE "ascents" DROP COLUMN "session_id";
