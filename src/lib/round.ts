import { Decimal } from "decimal.js";

// Number.prototype.toFixed() (and Math.round, for the same underlying
// reason) round based on the EXACT binary floating-point value, which for
// a result that's "supposed" to be a clean decimal tie -- e.g.
// 0.01275*100, computed as 1.2749999999999999 in IEEE754 -- silently
// rounds the wrong way: (0.01275*100).toFixed(2) is "1.27", not the
// correct half-up "1.28". A real, previously-wrong example in this app
// without this fix: The Catch's Lv15 secondary stat (10 * 1.565) --
// toFixed(1) alone gives "15.6"; the correct half-up answer is "15.7".
//
// toPrecision(15) first collapses that representation noise back to the
// intended decimal -- a double reliably round-trips ~15-17 significant
// digits, and noise from a single arithmetic step shows up past that --
// before handing off to decimal.js for the actual half-up rounding, which
// operates on exact decimal digits and can't reintroduce the problem.
// This also neutralizes float noise already baked into source data (e.g.
// weapons.json's baseSecondaryStatValue has entries like
// 6.6667000000000005): never show that raw, always round through here.
function toCleanDecimal(value: number): Decimal {
  return new Decimal(value.toPrecision(15));
}

// Returns a number -- for a value about to be used in further arithmetic
// (e.g. a formula-mandated intermediate rounding step) or compared/
// sorted, not rendered directly.
export function roundHalfUp(value: number, decimals: number): number {
  return toCleanDecimal(value).toDecimalPlaces(decimals).toNumber();
}

// Returns a fixed-decimal string, always showing exactly `decimals` places
// (e.g. "15.0", not "15") -- a drop-in replacement for
// Number.prototype.toFixed() at the final display step.
export function roundHalfUpFixed(value: number, decimals: number): string {
  return toCleanDecimal(value).toFixed(decimals);
}
