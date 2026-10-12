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

// The highest level reachable without ascending again, e.g. phase 2 (already
// ascended past 40) caps out at 50. Used to show "Lv. X/Y" on the character
// hover overlay.
export function maxLevelForAscensionPhase(ascensionPhase: number): number {
  return PHASE_MAX_LEVEL[ascensionPhase];
}

// The lowest level a given ascension phase can be at, e.g. phase 2 starts at
// 40 (you ascend right at the previous phase's cap). Paired with
// maxLevelForAscensionPhase to clamp the level slider when the ascension
// diamonds are clicked directly (see CharacterProgressionEditor).
export function minLevelForAscensionPhase(ascensionPhase: number): number {
  return ascensionPhase === 0 ? MIN_LEVEL : PHASE_MAX_LEVEL[ascensionPhase - 1];
}

// Characters (NOT weapons -- WEAPON_ATTACK_LEVEL_MULTIPLIER in
// weapon-scaling.ts stops at level 90, confirmed character-only) can also
// reach level 95 and 100, both ONLY at the final ascension phase -- there's
// no phase 7 to require re-ascending past 90, so these two levels just
// extend phase 6 further. Levels 91-94 and 96-99 do not exist at all. See
// data-source/master-data-formulas.txt section 1.
//
// Deliberately kept separate from the exports above rather than changing
// MAX_LEVEL/validAscensionPhasesForLevel/maxLevelForAscensionPhase in
// place: those are shared with weapons (see owned-weapon-manager.tsx and
// weapons/schemas.ts), which must stay capped at 90 exactly as before.
export const CHARACTER_EXTRA_LEVELS = [95, 100] as const;
export const CHARACTER_MAX_LEVEL = 100;

function isCharacterExtraLevel(level: number): boolean {
  return (CHARACTER_EXTRA_LEVELS as readonly number[]).includes(level);
}

export function isValidCharacterLevel(level: number): boolean {
  return (level >= MIN_LEVEL && level <= MAX_LEVEL) || isCharacterExtraLevel(level);
}

// Like validAscensionPhasesForLevel, but for the character-only extended
// range: 95 and 100 each have exactly one valid phase (6) -- they are NOT
// breakpoints (which have two), they're just further into the same max
// phase.
export function validAscensionPhasesForCharacterLevel(level: number): number[] {
  if (isCharacterExtraLevel(level)) return [MAX_ASCENSION_PHASE];
  return validAscensionPhasesForLevel(level);
}

export function isValidCharacterLevelAscension(level: number, ascensionPhase: number): boolean {
  return validAscensionPhasesForCharacterLevel(level).includes(ascensionPhase);
}

// Like maxLevelForAscensionPhase, but phase 6's ceiling is 100 for
// characters (still 90 for weapons, via the unmodified function above).
export function characterMaxLevelForAscensionPhase(ascensionPhase: number): number {
  return ascensionPhase === MAX_ASCENSION_PHASE ? CHARACTER_MAX_LEVEL : maxLevelForAscensionPhase(ascensionPhase);
}
