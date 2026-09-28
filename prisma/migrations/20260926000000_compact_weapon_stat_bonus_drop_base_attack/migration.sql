-- CreateEnum
CREATE TYPE "WeaponStatBonusCurveType" AS ENUM ('Constant', 'Linear', 'Custom');

-- DropIndex
DROP INDEX "weapon_stat_bonuses_weapon_id_stat_type_id_refinement_key";

-- weapon_stat_bonuses is wholly seed-owned data, never user-edited, and
-- immediately re-populated by the next seed run -- safe to clear before
-- adding the new NOT NULL column.
DELETE FROM "weapon_stat_bonuses";

-- AlterTable
ALTER TABLE "weapon_stat_bonuses" DROP COLUMN "refinement",
DROP COLUMN "value",
ADD COLUMN     "base_value" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "curve_type" "WeaponStatBonusCurveType" NOT NULL,
ADD COLUMN     "custom_values" DOUBLE PRECISION[],
ADD COLUMN     "slope" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "weapons" DROP COLUMN "base_attack";

-- CreateIndex
CREATE UNIQUE INDEX "weapon_stat_bonuses_weapon_id_stat_type_id_key" ON "weapon_stat_bonuses"("weapon_id", "stat_type_id");
