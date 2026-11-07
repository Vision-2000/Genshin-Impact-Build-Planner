-- Renames the Roster/RosterBuild tables to Collection/CollectionBuild (and
-- the roster_id column to collection_id) -- a pure rename, not a
-- drop+recreate, so any existing rows survive. Same reasoning and same
-- hand-edit as the earlier Lineup -> Group rename (20261104140501):
-- Prisma's own auto-generated diff can't detect a rename in non-
-- interactive mode and proposed DROP TABLE + CREATE TABLE instead, which
-- would have silently discarded any saved rosters.

ALTER TABLE "rosters" RENAME TO "collections";
ALTER TABLE "roster_builds" RENAME TO "collection_builds";
ALTER TABLE "collection_builds" RENAME COLUMN "roster_id" TO "collection_id";

ALTER TABLE "collections" RENAME CONSTRAINT "rosters_pkey" TO "collections_pkey";
ALTER TABLE "collections" RENAME CONSTRAINT "rosters_game_profile_id_fkey" TO "collections_game_profile_id_fkey";

ALTER TABLE "collection_builds" RENAME CONSTRAINT "roster_builds_pkey" TO "collection_builds_pkey";
ALTER TABLE "collection_builds" RENAME CONSTRAINT "roster_builds_roster_id_fkey" TO "collection_builds_collection_id_fkey";
ALTER TABLE "collection_builds" RENAME CONSTRAINT "roster_builds_build_id_fkey" TO "collection_builds_build_id_fkey";
ALTER TABLE "collection_builds" RENAME CONSTRAINT "roster_builds_owned_character_id_fkey" TO "collection_builds_owned_character_id_fkey";

ALTER INDEX "roster_builds_roster_id_owned_character_id_key" RENAME TO "collection_builds_collection_id_owned_character_id_key";
