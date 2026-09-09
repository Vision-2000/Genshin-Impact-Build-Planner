import { ArtifactSlot } from "@/generated/prisma/enums";

// Generic per-slot icons (Flower of Life, Plume of Death, Sands of Eon,
// Goblet of Eonothem, Circlet of Logos) -- distinct from the per-set icons
// stored on ArtifactSet (flowerIconUrl etc.), which show that set's own art
// for the slot. These are for contexts with no specific set in play, e.g.
// the owned-artifacts slot filter, same idea as WEAPON_TYPE_ICON_URL.
// Downloaded once from the Genshin Impact Fandom wiki's static asset CDN
// into public/icons (see weapon-type-icons.ts for why local files).
export const ARTIFACT_SLOT_ICON_URL: Record<ArtifactSlot, string> = {
  [ArtifactSlot.Flower]: "/icons/artifact-flower.webp",
  [ArtifactSlot.Feather]: "/icons/artifact-feather.webp",
  [ArtifactSlot.Sands]: "/icons/artifact-sands.webp",
  [ArtifactSlot.Goblet]: "/icons/artifact-goblet.webp",
  [ArtifactSlot.Circlet]: "/icons/artifact-circlet.webp",
};
