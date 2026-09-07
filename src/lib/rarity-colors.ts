// Maps a rarity number to its card background gradient, matching the
// in-game convention (5=gold, 4=purple, 3=blue, 2=green, 1=gray). Characters
// and Weapons only ever reach 4-5 / 3-5 star, but OwnedArtifact can roll any
// value in the full 1-5 range, so this covers all five tiers even though the
// lower ones are only ever exercised by Artifacts.
export function rarityGradientClasses(rarity: number): string {
  if (rarity >= 5) return "bg-gradient-to-b from-yellow-700 via-amber-700 to-yellow-900";
  if (rarity === 4) return "bg-gradient-to-b from-purple-800 via-purple-700 to-purple-950";
  if (rarity === 3) return "bg-gradient-to-b from-blue-800 via-blue-700 to-blue-950";
  if (rarity === 2) return "bg-gradient-to-b from-green-800 via-green-700 to-green-950";
  return "bg-gradient-to-b from-gray-600 via-gray-500 to-gray-700";
}
