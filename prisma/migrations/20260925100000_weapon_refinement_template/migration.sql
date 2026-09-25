-- CreateEnum
CREATE TYPE "WeaponRefinementCurveType" AS ENUM ('Linear', 'Custom');

-- AlterTable
ALTER TABLE "weapons" ADD COLUMN     "max_refinement" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "passive_description_template" TEXT;

-- CreateTable
CREATE TABLE "weapon_refinement_values" (
    "id" SERIAL NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "curve_type" "WeaponRefinementCurveType" NOT NULL,
    "base_value" DOUBLE PRECISION NOT NULL,
    "slope" DOUBLE PRECISION,
    "custom_values" DOUBLE PRECISION[],

    CONSTRAINT "weapon_refinement_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weapon_refinement_values_weapon_id_slot_index_key" ON "weapon_refinement_values"("weapon_id", "slot_index");

-- AddForeignKey
ALTER TABLE "weapon_refinement_values" ADD CONSTRAINT "weapon_refinement_values_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
