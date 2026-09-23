// Flat stats (HP/ATK/DEF/Elemental Mastery) display as whole numbers
// in-game; every %-based stat (its StatType.name itself ends in "%", e.g.
// "Crit Rate%", "Energy Recharge%") shows 1 decimal. Mirrors the convention
// already used inline for artifact substats (owned-artifact-manager.tsx),
// extracted here since the character progression editor needs the same
// formatting for ascension/talent/constellation stat bonuses.
export function formatStatValue(statName: string, value: number): string {
  return value.toFixed(statName.endsWith("%") ? 1 : 0);
}
