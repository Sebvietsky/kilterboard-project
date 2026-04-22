/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `board_layouts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "grades" ALTER COLUMN "vScale" SET DATA TYPE VARCHAR(5),
ALTER COLUMN "fontScale" SET DATA TYPE VARCHAR(5);

-- CreateIndex
CREATE UNIQUE INDEX "board_layouts_name_key" ON "board_layouts"("name");
