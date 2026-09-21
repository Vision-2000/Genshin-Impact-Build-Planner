// The game's 6 level thresholds where a character/weapon can be at either
// the ascension phase just reached or the one before it (same level,
// different stats/unlocks) -- every other level has exactly one valid
// phase. Shared between prisma/seed.ts (sampling genshin-db's stats
// function at each of these) and the owned-character/weapon level-editing
// UI, so both agree on what counts as a valid level+ascensionPhase pair.
export const ASCENSION_BREAKPOINTS = [20, 40, 50, 60, 70, 80];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 90;
export const MAX_ASCENSION_PHASE = 6;

// Index = ascension phase, value = the highest level reachable at that
// phase (phase 0 covers levels 1-20, phase 1 covers 20-40, etc.) -- derived
// from ASCENSION_BREAKPOINTS rather than duplicated, so the two can't drift
// apart.
const PHASE_MAX_LEVEL = [...ASCENSION_BREAKPOINTS, MAX_LEVEL];

// Every ascension phase a given level could actually be at: one entry
// normally, two at a breakpoint level (pre- and post-ascension). Returns
// an empty array for a level outside [MIN_LEVEL, MAX_LEVEL].
export function validAscensionPhasesForLevel(level: number): number[] {
  if (level < MIN_LEVEL || level > MAX_LEVEL) return [];

  const phases: number[] = [];
  for (let phase = 0; phase <= MAX_ASCENSION_PHASE; phase++) {
    const minLevel = phase === 0 ? MIN_LEVEL : PHASE_MAX_LEVEL[phase - 1];
    const maxLevel = PHASE_MAX_LEVEL[phase];
    if (level >= minLevel && level <= maxLevel) phases.push(phase);
  }
  return phases;
}

export function isValidLevelAscension(level: number, ascensionPhase: number): boolean {
  return validAscensionPhasesForLevel(level).includes(ascensionPhase);
}
