-- Rarity moves from OwnedArtifact (user-entered per piece) to ArtifactSet
-- (fixed per set, e.g. Instructor/Exile top out at 4-star). Temporary
-- default satisfies existing rows; the next `prisma db seed` run overwrites
-- every set's rarity with its real value from genshin-db.
ALTER TABLE "artifact_sets" ADD COLUMN "rarity" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "artifact_sets" ALTER COLUMN "rarity" DROP DEFAULT;

ALTER TABLE "owned_artifacts" DROP COLUMN "rarity";
