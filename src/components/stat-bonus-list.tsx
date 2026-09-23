import { formatStatValue } from "@/lib/stat-format";

// A talent/constellation/weapon-refinement's unconditional stat bonus, if
// it has one (most don't -- see TalentStatBonus's schema comment). Shared
// between the character progression editor's tooltips and the weapon
// progression editor's passive block.
export function StatBonusList({ statBonuses }: { statBonuses: { statTypeName: string; value: number }[] }) {
  if (statBonuses.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-gray-300">
      {statBonuses.map((b) => (
        <li key={b.statTypeName}>
          +{formatStatValue(b.statTypeName, b.value)} {b.statTypeName}
        </li>
      ))}
    </ul>
  );
}
