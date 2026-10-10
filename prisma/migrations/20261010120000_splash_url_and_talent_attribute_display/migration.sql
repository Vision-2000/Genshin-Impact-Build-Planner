-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "splash_url" TEXT;

-- AlterTable
ALTER TABLE "talent_attributes" ADD COLUMN     "hit_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "suffix" TEXT;
