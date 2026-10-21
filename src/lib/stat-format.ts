import { roundHalfUpFixed } from "./round";

// Flat stats (HP/ATK/DEF/Elemental Mastery) display as whole numbers
// in-game; every %-based stat (its StatType.name itself ends in "%", e.g.
// "Crit Rate%", "Energy Recharge%") shows 1 decimal. Shared by
// formatStatValue below and artifact-rules.ts's own substatRollCount, which
// needs to know what precision the user actually SEES a substat at before
// deciding whether two different stored values should be treated as the
// same roll outcome for validation purposes.
export function displayDecimals(statName: string): number {
  return statName.endsWith("%") ? 1 : 0;
}

// roundHalfUpFixed, not Number.prototype.toFixed, since a totaled stat can
// land exactly on a tie that toFixed's binary-float rounding gets wrong
// (see src/lib/round.ts) -- and this also neutralizes any float noise
// already baked into a stored value (e.g. weapons.json's
// baseSecondaryStatValue has entries like 6.6667000000000005) before it
// ever reaches the screen.
export function formatStatValue(statName: string, value: number): string {
  return roundHalfUpFixed(value, displayDecimals(statName));
}
