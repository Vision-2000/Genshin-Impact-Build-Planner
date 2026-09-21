-- AlterTable
ALTER TABLE "owned_characters" ADD COLUMN     "ascension_phase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "burst_level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "constellation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "normal_attack_level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "skill_level" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "owned_weapons" ADD COLUMN     "ascension_phase" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1;

