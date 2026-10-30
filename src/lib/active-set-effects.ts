// Shared by the Builds page's own BuildItem (src/app/(app)/builds/
// filter-sort.ts) and the Teams page's own BuildOption (src/app/(app)/teams/
// filter-sort.ts) -- extracted once a second page needed the exact same
// "which artifact set effects are active on this build" computation, same
// reasoning as this app's other src/lib extractions (elemental-resonance.ts,
// moonsign-hexerei.ts, ...).
export type ActiveSetEffectItem = {
  setName: string;
  flowerIconUrl: string | null;
  rarity: number;
  maxPiece: 2 | 4;
};

// Groups a build's own equipped artifact pieces by their set, keeping only
// sets with 2+ pieces equipped (the threshold for any set effect to
// activate at all) -- maxPiece is 4 once a set reaches that many pieces, 2
// otherwise (3 pieces of the same set still only grants the 2pc effect,
// there's no 3pc tier in this game).
export function computeActiveSetEffects(
  buildArtifacts: {
    ownedArtifact: { artifactSet: { id: number; name: string; rarity: number; flowerIconUrl: string | null } };
  }[]
): ActiveSetEffectItem[] {
  const setPieceCounts = new Map<
    number,
    { setName: string; flowerIconUrl: string | null; rarity: number; count: number }
  >();
  for (const ba of buildArtifacts) {
    const set = ba.ownedArtifact.artifactSet;
    const existing = setPieceCounts.get(set.id);
    if (existing) {
      existing.count += 1;
    } else {
      setPieceCounts.set(set.id, { setName: set.name, flowerIconUrl: set.flowerIconUrl, rarity: set.rarity, count: 1 });
    }
  }
  return [...setPieceCounts.values()]
    .filter((s) => s.count >= 2)
    .map((s) => ({
      setName: s.setName,
      flowerIconUrl: s.flowerIconUrl,
      rarity: s.rarity,
      maxPiece: (s.count >= 4 ? 4 : 2) as 2 | 4,
    }));
}
