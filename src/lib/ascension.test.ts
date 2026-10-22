import { describe, it, expect } from "vitest";
import {
  validAscensionPhasesForLevel,
  isValidLevelAscension,
  maxLevelForAscensionPhase,
  minLevelForAscensionPhase,
  isValidCharacterLevel,
  validAscensionPhasesForCharacterLevel,
  isValidCharacterLevelAscension,
  characterMaxLevelForAscensionPhase,
  characterLevelDisplayCap,
} from "./ascension";

describe("validAscensionPhasesForLevel", () => {
  it("returns a single phase for a non-breakpoint level", () => {
    expect(validAscensionPhasesForLevel(1)).toEqual([0]);
    expect(validAscensionPhasesForLevel(45)).toEqual([2]);
    expect(validAscensionPhasesForLevel(90)).toEqual([6]);
  });

  it("returns both phases for a breakpoint level", () => {
    expect(validAscensionPhasesForLevel(20)).toEqual([0, 1]);
    expect(validAscensionPhasesForLevel(40)).toEqual([1, 2]);
    expect(validAscensionPhasesForLevel(80)).toEqual([5, 6]);
  });

  it("returns an empty array outside the valid level range", () => {
    expect(validAscensionPhasesForLevel(0)).toEqual([]);
    expect(validAscensionPhasesForLevel(91)).toEqual([]);
  });
});

describe("isValidLevelAscension", () => {
  it("accepts a matching level/phase pair", () => {
    expect(isValidLevelAscension(45, 2)).toBe(true);
    expect(isValidLevelAscension(20, 0)).toBe(true);
    expect(isValidLevelAscension(20, 1)).toBe(true);
  });

  it("rejects a mismatched level/phase pair", () => {
    expect(isValidLevelAscension(45, 1)).toBe(false);
    expect(isValidLevelAscension(45, 3)).toBe(false);
    expect(isValidLevelAscension(21, 0)).toBe(false);
  });
});

describe("maxLevelForAscensionPhase", () => {
  it("returns the breakpoint level for phases 0-5", () => {
    expect(maxLevelForAscensionPhase(0)).toBe(20);
    expect(maxLevelForAscensionPhase(1)).toBe(40);
    expect(maxLevelForAscensionPhase(5)).toBe(80);
  });

  it("returns the level cap for the final phase", () => {
    expect(maxLevelForAscensionPhase(6)).toBe(90);
  });
});

describe("minLevelForAscensionPhase", () => {
  it("returns MIN_LEVEL for phase 0", () => {
    expect(minLevelForAscensionPhase(0)).toBe(1);
  });

  it("returns the previous phase's breakpoint for phases 1-6", () => {
    expect(minLevelForAscensionPhase(1)).toBe(20);
    expect(minLevelForAscensionPhase(2)).toBe(40);
    expect(minLevelForAscensionPhase(6)).toBe(80);
  });
});

describe("isValidCharacterLevel", () => {
  it("accepts every level in the normal continuous range", () => {
    expect(isValidCharacterLevel(1)).toBe(true);
    expect(isValidCharacterLevel(45)).toBe(true);
    expect(isValidCharacterLevel(90)).toBe(true);
  });

  it("accepts 95 and 100", () => {
    expect(isValidCharacterLevel(95)).toBe(true);
    expect(isValidCharacterLevel(100)).toBe(true);
  });

  it("rejects the gaps (91-94, 96-99) and anything outside [1,100]", () => {
    expect(isValidCharacterLevel(91)).toBe(false);
    expect(isValidCharacterLevel(94)).toBe(false);
    expect(isValidCharacterLevel(96)).toBe(false);
    expect(isValidCharacterLevel(99)).toBe(false);
    expect(isValidCharacterLevel(0)).toBe(false);
    expect(isValidCharacterLevel(101)).toBe(false);
  });
});

describe("validAscensionPhasesForCharacterLevel", () => {
  it("matches validAscensionPhasesForLevel for the normal range", () => {
    expect(validAscensionPhasesForCharacterLevel(45)).toEqual([2]);
    expect(validAscensionPhasesForCharacterLevel(80)).toEqual([5, 6]);
  });

  it("returns only phase 6 for 95 and 100 (not a breakpoint, not two phases)", () => {
    expect(validAscensionPhasesForCharacterLevel(95)).toEqual([6]);
    expect(validAscensionPhasesForCharacterLevel(100)).toEqual([6]);
  });

  it("returns an empty array for the gap levels", () => {
    expect(validAscensionPhasesForCharacterLevel(92)).toEqual([]);
    expect(validAscensionPhasesForCharacterLevel(97)).toEqual([]);
  });
});

describe("isValidCharacterLevelAscension", () => {
  it("accepts 95/100 only at phase 6", () => {
    expect(isValidCharacterLevelAscension(95, 6)).toBe(true);
    expect(isValidCharacterLevelAscension(100, 6)).toBe(true);
    expect(isValidCharacterLevelAscension(95, 5)).toBe(false);
    expect(isValidCharacterLevelAscension(100, 0)).toBe(false);
  });

  it("rejects a gap level at any phase", () => {
    expect(isValidCharacterLevelAscension(93, 6)).toBe(false);
  });
});

describe("characterMaxLevelForAscensionPhase", () => {
  it("returns 100 for phase 6 (vs. 90 for weapons' maxLevelForAscensionPhase)", () => {
    expect(characterMaxLevelForAscensionPhase(6)).toBe(100);
    expect(maxLevelForAscensionPhase(6)).toBe(90);
  });

  it("matches maxLevelForAscensionPhase for phases 0-5", () => {
    expect(characterMaxLevelForAscensionPhase(0)).toBe(20);
    expect(characterMaxLevelForAscensionPhase(5)).toBe(80);
  });
});

describe("characterLevelDisplayCap", () => {
  // Regression guard for a real bug: a level-90 phase-6 character's "Lv.
  // X/Y" badge showed "90/100" (via characterMaxLevelForAscensionPhase,
  // which is right for CLAMPING but wrong for display -- see its own
  // comment). 90/95/100 are three separate resting points, not a
  // continuous range, so each must pair with itself, never with 100.
  it("pairs each of the three phase-6 resting levels with itself, not a flat 100", () => {
    expect(characterLevelDisplayCap(90, 6)).toBe(90);
    expect(characterLevelDisplayCap(95, 6)).toBe(95);
    expect(characterLevelDisplayCap(100, 6)).toBe(100);
  });

  it("still reports the real phase cap for a level short of it", () => {
    expect(characterLevelDisplayCap(15, 0)).toBe(20);
    expect(characterLevelDisplayCap(45, 2)).toBe(50);
    expect(characterLevelDisplayCap(85, 6)).toBe(90);
  });
});
