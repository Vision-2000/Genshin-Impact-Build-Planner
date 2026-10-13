import { roundHalfUpFixed } from "./round";

// Flat stats (HP/ATK/DEF/Elemental Mastery) display as whole numbers
// in-game; every %-based stat (its StatType.name itself ends in "%", e.g.
// "Crit Rate%", "Energy Recharge%") shows 1 decimal. Shared by the
// character progression editor (ascension/talent/constellation stat
// bonuses) and every artifact substat display.
// roundHalfUpFixed, not Number.prototype.toFixed, since a totaled stat can
// land exactly on a tie that toFixed's binary-float rounding gets wrong
// (see src/lib/round.ts) -- and this also neutralizes any float noise
// already baked into a stored value (e.g. weapons.json's
// baseSecondaryStatValue has entries like 6.6667000000000005) before it
// ever reaches the screen.
export function formatStatValue(statName: string, value: number): string {
  return roundHalfUpFixed(value, statName.endsWith("%") ? 1 : 0);
}
