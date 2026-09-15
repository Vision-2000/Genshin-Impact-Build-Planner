-- CreateEnum
CREATE TYPE "TalentSlot" AS ENUM ('NormalAttack', 'Skill', 'Burst', 'Passive1', 'Passive2', 'Passive3', 'Passive4');

-- CreateEnum
CREATE TYPE "ArtifactSetPiece" AS ENUM ('Two', 'Four');

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "ascension_stat_id" INTEGER;

-- AlterTable
ALTER TABLE "weapons" DROP COLUMN "passive_text",
ADD COLUMN     "passive_name" TEXT;

-- CreateTable
CREATE TABLE "character_level_stats" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "ascension_phase" INTEGER NOT NULL,
    "hp" DOUBLE PRECISION NOT NULL,
    "attack" DOUBLE PRECISION NOT NULL,
    "defense" DOUBLE PRECISION NOT NULL,
    "ascension_stat_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "character_level_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talents" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "slot" "TalentSlot" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "talents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_attributes" (
    "id" SERIAL NOT NULL,
    "talent_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "format_code" TEXT NOT NULL,
    "values" DOUBLE PRECISION[],
    "order" INTEGER NOT NULL,

    CONSTRAINT "talent_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_stat_bonuses" (
    "id" SERIAL NOT NULL,
    "talent_id" INTEGER NOT NULL,
    "stat_type_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "talent_stat_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constellations" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "constellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constellation_stat_bonuses" (
    "id" SERIAL NOT NULL,
    "constellation_id" INTEGER NOT NULL,
    "stat_type_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "constellation_stat_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapon_level_stats" (
    "id" SERIAL NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "ascension_phase" INTEGER NOT NULL,
    "attack" DOUBLE PRECISION NOT NULL,
    "secondary_stat_value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "weapon_level_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapon_refinement_effects" (
    "id" SERIAL NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "refinement" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "weapon_refinement_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapon_stat_bonuses" (
    "id" SERIAL NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "stat_type_id" INTEGER NOT NULL,
    "refinement" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "weapon_stat_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_set_stat_bonuses" (
    "id" SERIAL NOT NULL,
    "artifact_set_id" INTEGER NOT NULL,
    "piece" "ArtifactSetPiece" NOT NULL,
    "stat_type_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "artifact_set_stat_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "character_level_stats_character_id_level_ascension_phase_key" ON "character_level_stats"("character_id", "level", "ascension_phase");

-- CreateIndex
CREATE UNIQUE INDEX "talents_character_id_slot_key" ON "talents"("character_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "constellations_character_id_number_key" ON "constellations"("character_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "weapon_level_stats_weapon_id_level_ascension_phase_key" ON "weapon_level_stats"("weapon_id", "level", "ascension_phase");

-- CreateIndex
CREATE UNIQUE INDEX "weapon_refinement_effects_weapon_id_refinement_key" ON "weapon_refinement_effects"("weapon_id", "refinement");

-- CreateIndex
CREATE UNIQUE INDEX "weapon_stat_bonuses_weapon_id_stat_type_id_refinement_key" ON "weapon_stat_bonuses"("weapon_id", "stat_type_id", "refinement");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_ascension_stat_id_fkey" FOREIGN KEY ("ascension_stat_id") REFERENCES "stat_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_level_stats" ADD CONSTRAINT "character_level_stats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talents" ADD CONSTRAINT "talents_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_attributes" ADD CONSTRAINT "talent_attributes_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_stat_bonuses" ADD CONSTRAINT "talent_stat_bonuses_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_stat_bonuses" ADD CONSTRAINT "talent_stat_bonuses_stat_type_id_fkey" FOREIGN KEY ("stat_type_id") REFERENCES "stat_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constellations" ADD CONSTRAINT "constellations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constellation_stat_bonuses" ADD CONSTRAINT "constellation_stat_bonuses_constellation_id_fkey" FOREIGN KEY ("constellation_id") REFERENCES "constellations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constellation_stat_bonuses" ADD CONSTRAINT "constellation_stat_bonuses_stat_type_id_fkey" FOREIGN KEY ("stat_type_id") REFERENCES "stat_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_level_stats" ADD CONSTRAINT "weapon_level_stats_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_refinement_effects" ADD CONSTRAINT "weapon_refinement_effects_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_stat_bonuses" ADD CONSTRAINT "weapon_stat_bonuses_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_stat_bonuses" ADD CONSTRAINT "weapon_stat_bonuses_stat_type_id_fkey" FOREIGN KEY ("stat_type_id") REFERENCES "stat_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_set_stat_bonuses" ADD CONSTRAINT "artifact_set_stat_bonuses_artifact_set_id_fkey" FOREIGN KEY ("artifact_set_id") REFERENCES "artifact_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_set_stat_bonuses" ADD CONSTRAINT "artifact_set_stat_bonuses_stat_type_id_fkey" FOREIGN KEY ("stat_type_id") REFERENCES "stat_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

