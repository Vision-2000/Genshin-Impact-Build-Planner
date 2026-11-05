-- Renames the Lineup/LineupTeam tables to Group/GroupTeam (and the
-- lineup_id column to group_id) -- a pure rename, not a drop+recreate, so
-- any existing rows survive. Prisma's own auto-generated diff (for a
-- rename it can't detect automatically in non-interactive mode) proposed
-- DROP TABLE + CREATE TABLE instead, which would have silently discarded
-- any saved lineups; this was hand-edited to use RENAME statements, which
-- Postgres performs in place.

ALTER TABLE "lineups" RENAME TO "groups";
ALTER TABLE "lineup_teams" RENAME TO "group_teams";
ALTER TABLE "group_teams" RENAME COLUMN "lineup_id" TO "group_id";

ALTER TABLE "groups" RENAME CONSTRAINT "lineups_pkey" TO "groups_pkey";
ALTER TABLE "groups" RENAME CONSTRAINT "lineups_game_profile_id_fkey" TO "groups_game_profile_id_fkey";

ALTER TABLE "group_teams" RENAME CONSTRAINT "lineup_teams_pkey" TO "group_teams_pkey";
ALTER TABLE "group_teams" RENAME CONSTRAINT "lineup_teams_lineup_id_fkey" TO "group_teams_group_id_fkey";
ALTER TABLE "group_teams" RENAME CONSTRAINT "lineup_teams_team_id_fkey" TO "group_teams_team_id_fkey";

ALTER INDEX "lineup_teams_lineup_id_team_id_key" RENAME TO "group_teams_group_id_team_id_key";
