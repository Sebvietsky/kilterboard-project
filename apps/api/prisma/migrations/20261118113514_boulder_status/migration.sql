-- CreateEnum
CREATE TYPE "BoulderStatus" AS ENUM ('DRAFT', 'PUBLIC');

-- AlterTable
ALTER TABLE "boulders" ADD COLUMN     "status" "BoulderStatus" NOT NULL DEFAULT 'DRAFT';

-- Migration de données, ajoutée à la main : le SQL généré supprimait les
-- booléens avant de remplir `status`, et tous les blocs passaient en DRAFT.
-- Seul un bloc publié et public devient PUBLIC. Le bloc privé disparaît
-- (décision du 2026-11-18) : comme le brouillon, il n'était visible que de
-- son créateur, et il redevient un brouillon.
UPDATE "boulders"
SET "status" = CASE
  WHEN "is_public" AND NOT "is_draft" THEN 'PUBLIC'::"BoulderStatus"
  ELSE 'DRAFT'::"BoulderStatus"
END;

-- AlterTable
ALTER TABLE "boulders" DROP COLUMN "is_draft",
DROP COLUMN "is_public";
