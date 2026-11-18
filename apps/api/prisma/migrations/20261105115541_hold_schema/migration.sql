-- CreateEnum
CREATE TYPE "HoldSet" AS ENUM ('BOLT_ONS', 'SCREW_ONS');

-- AlterTable
ALTER TABLE "board_layouts" DROP COLUMN "height",
DROP COLUMN "width";

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "size_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "holds" ADD COLUMN     "kilter_placement_id" INTEGER NOT NULL,
ADD COLUMN     "set" "HoldSet" NOT NULL;

-- CreateTable
CREATE TABLE "board_sizes" (
    "id" SERIAL NOT NULL,
    "layout_id" INTEGER NOT NULL,
    "kilter_size_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "edge_left" INTEGER NOT NULL,
    "edge_right" INTEGER NOT NULL,
    "edge_bottom" INTEGER NOT NULL,
    "edge_top" INTEGER NOT NULL,

    CONSTRAINT "board_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hold_leds" (
    "hold_id" INTEGER NOT NULL,
    "size_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "hold_leds_pkey" PRIMARY KEY ("hold_id","size_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "board_sizes_layout_id_kilter_size_id_key" ON "board_sizes"("layout_id", "kilter_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_sizes_layout_id_name_key" ON "board_sizes"("layout_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "hold_leds_size_id_position_key" ON "hold_leds"("size_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "holds_layout_id_kilter_placement_id_key" ON "holds"("layout_id", "kilter_placement_id");

-- AddForeignKey
ALTER TABLE "board_sizes" ADD CONSTRAINT "board_sizes_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "board_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "board_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_leds" ADD CONSTRAINT "hold_leds_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_leds" ADD CONSTRAINT "hold_leds_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "board_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

