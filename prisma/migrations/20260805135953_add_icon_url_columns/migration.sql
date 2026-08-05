-- AlterTable
ALTER TABLE "artifact_sets" ADD COLUMN     "circlet_icon_url" TEXT,
ADD COLUMN     "feather_icon_url" TEXT,
ADD COLUMN     "flower_icon_url" TEXT,
ADD COLUMN     "goblet_icon_url" TEXT,
ADD COLUMN     "sands_icon_url" TEXT;

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "icon_url" TEXT;

-- AlterTable
ALTER TABLE "weapons" ADD COLUMN     "icon_url" TEXT;
