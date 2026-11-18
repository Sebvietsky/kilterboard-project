-- CreateEnum
CREATE TYPE "BoulderStatus" AS ENUM ('DRAFT', 'PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "boulders" ADD COLUMN     "status" "BoulderStatus" NOT NULL DEFAULT 'DRAFT';

-- Migration de données, ajoutée à la main : le SQL généré supprimait les
-- booléens avant de remplir `status`, et tous les blocs passaient en DRAFT.
-- Un brouillon le reste, même marqué public : cet état n'a pas de sens.
UPDATE "boulders"
SET "status" = CASE
  WHEN "is_draft" THEN 'DRAFT'::"BoulderStatus"
  WHEN "is_public" THEN 'PUBLIC'::"BoulderStatus"
  ELSE 'PRIVATE'::"BoulderStatus"
END;

-- AlterTable
ALTER TABLE "boulders" DROP COLUMN "is_draft",
DROP COLUMN "is_public";
