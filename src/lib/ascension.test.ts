import { describe, it, expect } from "vitest";
import {
  validAscensionPhasesForLevel,
  isValidLevelAscension,
  maxLevelForAscensionPhase,
  minLevelForAscensionPhase,
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
