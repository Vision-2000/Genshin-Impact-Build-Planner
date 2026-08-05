-- CreateEnum
CREATE TYPE "Element" AS ENUM ('Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro');

-- CreateEnum
CREATE TYPE "WeaponType" AS ENUM ('Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst');

-- CreateEnum
CREATE TYPE "ArtifactSlot" AS ENUM ('Flower', 'Feather', 'Sands', 'Goblet', 'Circlet');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "uid" TEXT,
    "avatar_character_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "element" "Element" NOT NULL,
    "weapon_type" "WeaponType" NOT NULL,
    "rarity" INTEGER NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapons" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "weapon_type" "WeaponType" NOT NULL,
    "rarity" INTEGER NOT NULL,
    "secondary_stat_id" INTEGER,
    "passive_text" TEXT,

    CONSTRAINT "weapons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_sets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "two_piece_effect" TEXT NOT NULL,
    "four_piece_effect" TEXT,

    CONSTRAINT "artifact_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "stat_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owned_characters" (
    "id" SERIAL NOT NULL,
    "game_profile_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "is_owned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owned_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owned_weapons" (
    "id" SERIAL NOT NULL,
    "game_profile_id" INTEGER NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "refinement" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owned_weapons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owned_artifacts" (
    "id" SERIAL NOT NULL,
    "game_profile_id" INTEGER NOT NULL,
    "artifact_set_id" INTEGER NOT NULL,
    "slot" "ArtifactSlot" NOT NULL,
    "rarity" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "main_stat_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owned_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owned_artifact_substats" (
    "id" SERIAL NOT NULL,
    "owned_artifact_id" INTEGER NOT NULL,
    "stat_type_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "owned_artifact_substats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" SERIAL NOT NULL,
    "owned_character_id" INTEGER NOT NULL,
    "owned_weapon_id" INTEGER,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_artifacts" (
    "id" SERIAL NOT NULL,
    "build_id" INTEGER NOT NULL,
    "owned_artifact_id" INTEGER NOT NULL,
    "slot" "ArtifactSlot" NOT NULL,

    CONSTRAINT "build_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "game_profile_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_builds" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "build_id" INTEGER NOT NULL,
    "owned_character_id" INTEGER NOT NULL,

    CONSTRAINT "team_builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rosters" (
    "id" SERIAL NOT NULL,
    "game_profile_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_builds" (
    "id" SERIAL NOT NULL,
    "roster_id" INTEGER NOT NULL,
    "build_id" INTEGER NOT NULL,
    "owned_character_id" INTEGER NOT NULL,

    CONSTRAINT "roster_builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineups" (
    "id" SERIAL NOT NULL,
    "game_profile_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineup_teams" (
    "id" SERIAL NOT NULL,
    "lineup_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,

    CONSTRAINT "lineup_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "characters_name_key" ON "characters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "weapons_name_key" ON "weapons"("name");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_sets_name_key" ON "artifact_sets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stat_types_name_key" ON "stat_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "owned_characters_game_profile_id_character_id_key" ON "owned_characters"("game_profile_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "owned_artifact_substats_owned_artifact_id_stat_type_id_key" ON "owned_artifact_substats"("owned_artifact_id", "stat_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "builds_owned_character_id_name_key" ON "builds"("owned_character_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "build_artifacts_build_id_slot_key" ON "build_artifacts"("build_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "team_builds_team_id_owned_character_id_key" ON "team_builds"("team_id", "owned_character_id");

-- CreateIndex
CREATE UNIQUE INDEX "roster_builds_roster_id_owned_character_id_key" ON "roster_builds"("roster_id", "owned_character_id");

-- CreateIndex
CREATE UNIQUE INDEX "lineup_teams_lineup_id_team_id_key" ON "lineup_teams"("lineup_id", "team_id");

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_avatar_character_id_fkey" FOREIGN KEY ("avatar_character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapons" ADD CONSTRAINT "weapons_secondary_stat_id_fkey" FOREIGN KEY ("secondary_stat_id") REFERENCES "stat_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_characters" ADD CONSTRAINT "owned_characters_game_profile_id_fkey" FOREIGN KEY ("game_profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_characters" ADD CONSTRAINT "owned_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_weapons" ADD CONSTRAINT "owned_weapons_game_profile_id_fkey" FOREIGN KEY ("game_profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_weapons" ADD CONSTRAINT "owned_weapons_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_artifacts" ADD CONSTRAINT "owned_artifacts_game_profile_id_fkey" FOREIGN KEY ("game_profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_artifacts" ADD CONSTRAINT "owned_artifacts_artifact_set_id_fkey" FOREIGN KEY ("artifact_set_id") REFERENCES "artifact_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_artifacts" ADD CONSTRAINT "owned_artifacts_main_stat_id_fkey" FOREIGN KEY ("main_stat_id") REFERENCES "stat_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_artifact_substats" ADD CONSTRAINT "owned_artifact_substats_owned_artifact_id_fkey" FOREIGN KEY ("owned_artifact_id") REFERENCES "owned_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_artifact_substats" ADD CONSTRAINT "owned_artifact_substats_stat_type_id_fkey" FOREIGN KEY ("stat_type_id") REFERENCES "stat_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_owned_character_id_fkey" FOREIGN KEY ("owned_character_id") REFERENCES "owned_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_owned_weapon_id_fkey" FOREIGN KEY ("owned_weapon_id") REFERENCES "owned_weapons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_artifacts" ADD CONSTRAINT "build_artifacts_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_artifacts" ADD CONSTRAINT "build_artifacts_owned_artifact_id_fkey" FOREIGN KEY ("owned_artifact_id") REFERENCES "owned_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_profile_id_fkey" FOREIGN KEY ("game_profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_builds" ADD CONSTRAINT "team_builds_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_builds" ADD CONSTRAINT "team_builds_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_builds" ADD CONSTRAINT "team_builds_owned_character_id_fkey" FOREIGN KEY ("owned_character_id") REFERENCES "owned_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_game_profile_id_fkey" FOREIGN KEY ("game_profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_builds" ADD CONSTRAINT "roster_builds_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_builds" ADD CONSTRAINT "roster_builds_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_builds" ADD CONSTRAINT "roster_builds_owned_character_id_fkey" FOREIGN KEY ("owned_character_id") REFERENCES "owned_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_game_profile_id_fkey" FOREIGN KEY ("game_profile_id") REFERENCES "game_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup_teams" ADD CONSTRAINT "lineup_teams_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "lineups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup_teams" ADD CONSTRAINT "lineup_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
