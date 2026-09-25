-- CreateEnum
CREATE TYPE "TalentCurveType" AS ENUM ('Physical1', 'Physical1Alternative', 'Physical2', 'Elemental1', 'Elemental1Alternative', 'Elemental2', 'EffectFlat', 'BeidouDmgReduction', 'ZhongliBurst', 'Linear', 'Constant', 'Custom');

-- DropForeignKey
ALTER TABLE "character_level_stats" DROP CONSTRAINT "character_level_stats_character_id_fkey";

-- DropForeignKey
ALTER TABLE "weapon_level_stats" DROP CONSTRAINT "weapon_level_stats_weapon_id_fkey";

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "base_attack" DOUBLE PRECISION,
ADD COLUMN     "base_defense" DOUBLE PRECISION,
ADD COLUMN     "base_hp" DOUBLE PRECISION,
ADD COLUMN     "max_ascension_attack" DOUBLE PRECISION,
ADD COLUMN     "max_ascension_defense" DOUBLE PRECISION,
ADD COLUMN     "max_ascension_hp" DOUBLE PRECISION;

-- talent_attributes is entirely seed-owned data (never user-edited, see
-- prisma/seed.ts's own "delete-and-recreate" comment on this table) and is
-- about to be fully re-seeded with the new compact representation
-- immediately after this migration runs -- clearing it here is what makes
-- the NOT NULL columns below addable at all against the existing 2880 rows.
DELETE FROM "talent_attributes";

-- AlterTable
ALTER TABLE "talent_attributes" DROP COLUMN "values",
ADD COLUMN     "base_value" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "cap_level" INTEGER,
ADD COLUMN     "curve_type" "TalentCurveType" NOT NULL,
ADD COLUMN     "custom_values" DOUBLE PRECISION[],
ADD COLUMN     "linear_slope" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "weapons" ADD COLUMN     "attack_tier" INTEGER,
ADD COLUMN     "base_attack" DOUBLE PRECISION,
ADD COLUMN     "base_secondary_stat_value" DOUBLE PRECISION;

-- DropTable
DROP TABLE "character_level_stats";

-- DropTable
DROP TABLE "weapon_level_stats";
