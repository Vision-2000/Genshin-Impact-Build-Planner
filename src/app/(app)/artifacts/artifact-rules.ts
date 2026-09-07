import { ArtifactSlot } from "@/generated/prisma/enums";

// Which StatType names each slot can actually roll as a main stat in-game.
// Flower/Feather are fixed and never vary; Sands/Goblet/Circlet each draw
// from their own subset. Not enforced by the schema (mainStatId is just an
// FK to StatType) — this is the frontend rule CLAUDE.md calls for elsewhere
// with "main stat excludes substat": real game constraints belong here, not
// the DB.
export const SLOT_MAIN_STATS: Record<ArtifactSlot, readonly string[]> = {
  [ArtifactSlot.Flower]: ["HP"],
  [ArtifactSlot.Feather]: ["ATK"],
  [ArtifactSlot.Sands]: ["HP%", "ATK%", "DEF%", "Elemental Mastery", "Energy Recharge%"],
  [ArtifactSlot.Goblet]: [
    "HP%",
    "ATK%",
    "DEF%",
    "Elemental Mastery",
    "Physical DMG Bonus%",
    "Pyro DMG Bonus%",
    "Hydro DMG Bonus%",
    "Electro DMG Bonus%",
    "Cryo DMG Bonus%",
    "Anemo DMG Bonus%",
    "Geo DMG Bonus%",
    "Dendro DMG Bonus%",
  ],
  [ArtifactSlot.Circlet]: ["HP%", "ATK%", "DEF%", "Elemental Mastery", "Crit Rate%", "Crit DMG%", "Healing Bonus%"],
};

// The only StatType names that can ever appear as a substat — elemental DMG
// bonuses, Healing Bonus%, and Physical DMG Bonus% are Goblet/Circlet main
// stats only and never roll as substats.
export const SUBSTAT_TYPE_NAMES = [
  "HP",
  "ATK",
  "DEF",
  "HP%",
  "ATK%",
  "DEF%",
  "Elemental Mastery",
  "Energy Recharge%",
  "Crit Rate%",
  "Crit DMG%",
] as const;

export type SubstatTypeName = (typeof SUBSTAT_TYPE_NAMES)[number];

export const MAX_SUBSTATS = 4;
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 20;
