import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Pass a suffix (e.g. "npx tsx data-export/export-master-data.mts v2") to
// write a new snapshot alongside earlier ones instead of overwriting them
// -- e.g. after a schema change, so the before/after shape can still be
// compared. No argument keeps the original unsuffixed filenames.
const suffix = process.argv[2] ? `-${process.argv[2]}` : "";
function fileName(base: string): string {
  return `${base}${suffix}.json`;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const outDir = path.join(process.cwd(), "data-export");
  fs.mkdirSync(outDir, { recursive: true });

  const statTypes = await prisma.statType.findMany({ orderBy: { name: "asc" } });
  fs.writeFileSync(path.join(outDir, fileName("stat-types")), JSON.stringify(statTypes, null, 2));
  console.log(`${fileName("stat-types")}: ${statTypes.length} rows`);

  const characters = await prisma.character.findMany({
    orderBy: { name: "asc" },
    include: {
      ascensionStat: true,
      talents: {
        orderBy: { slot: "asc" },
        include: {
          attributes: { orderBy: { order: "asc" } },
          statBonuses: { include: { statType: true } },
        },
      },
      constellations: {
        orderBy: { number: "asc" },
        include: { statBonuses: { include: { statType: true } } },
      },
    },
  });
  fs.writeFileSync(path.join(outDir, fileName("characters")), JSON.stringify(characters, null, 2));
  console.log(`${fileName("characters")}: ${characters.length} characters`);

  const weapons = await prisma.weapon.findMany({
    orderBy: { name: "asc" },
    include: {
      secondaryStat: true,
      refinementEffects: { orderBy: { refinement: "asc" } },
      refinementValues: { orderBy: { slotIndex: "asc" } },
      statBonuses: { include: { statType: true } },
    },
  });
  fs.writeFileSync(path.join(outDir, fileName("weapons")), JSON.stringify(weapons, null, 2));
  console.log(`${fileName("weapons")}: ${weapons.length} weapons`);

  const artifactSets = await prisma.artifactSet.findMany({
    orderBy: { name: "asc" },
    include: { statBonuses: { include: { statType: true } } },
  });
  fs.writeFileSync(path.join(outDir, fileName("artifact-sets")), JSON.stringify(artifactSets, null, 2));
  console.log(`${fileName("artifact-sets")}: ${artifactSets.length} artifact sets`);

  await prisma.$disconnect();
}

main();
