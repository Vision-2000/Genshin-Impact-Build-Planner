import { describe, it, expect } from "vitest";
import { validAscensionPhasesForLevel, isValidLevelAscension } from "./ascension";

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
