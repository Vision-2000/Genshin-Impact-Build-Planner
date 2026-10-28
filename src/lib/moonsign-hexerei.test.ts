import { describe, it, expect } from "vitest";
import { isMoonsignTalentName, isHexereiTalentName, computeMoonsignHexereiEffects } from "./moonsign-hexerei";

describe("isMoonsignTalentName", () => {
  it("matches a real Moonsign Benediction talent name", () => {
    expect(isMoonsignTalentName("Moonsign Benediction: Force Limit Analysis")).toBe(true);
  });

  it("doesn't match an unrelated talent name", () => {
    expect(isMoonsignTalentName("Structured Power Booster")).toBe(false);
  });

  it("doesn't match a name that only mentions Moonsign elsewhere in the string", () => {
    expect(isMoonsignTalentName("Something: Moonsign Benediction")).toBe(false);
  });
});

describe("isHexereiTalentName", () => {
  it("matches a real Witch's Eve Rite talent name", () => {
    expect(isHexereiTalentName("Witch's Eve Rite: Book of Blinding Light")).toBe(true);
  });

  it("doesn't match an unrelated talent name", () => {
    expect(isHexereiTalentName("Homuncular Nature")).toBe(false);
  });
});

describe("computeMoonsignHexereiEffects", () => {
  it("returns nothing with no Moonsign or Hexerei characters", () => {
    expect(computeMoonsignHexereiEffects({ moonsignCount: 0, hexereiCount: 0 })).toEqual([]);
  });

  it("activates only Nascent Gleam at exactly 1 Moonsign character", () => {
    const result = computeMoonsignHexereiEffects({ moonsignCount: 1, hexereiCount: 0 });
    expect(result.map((e) => e.name)).toEqual(["Nascent Gleam"]);
  });

  it("activates both Nascent Gleam and Ascendant Gleam at 2+ Moonsign characters", () => {
    const result = computeMoonsignHexereiEffects({ moonsignCount: 2, hexereiCount: 0 });
    expect(result.map((e) => e.name)).toEqual(["Nascent Gleam", "Ascendant Gleam"]);
  });

  it("does not activate Hexerei: Secret Rite with only 1 Hexerei character", () => {
    expect(computeMoonsignHexereiEffects({ moonsignCount: 0, hexereiCount: 1 })).toEqual([]);
  });

  it("activates Hexerei: Secret Rite at 2+ Hexerei characters", () => {
    const result = computeMoonsignHexereiEffects({ moonsignCount: 0, hexereiCount: 2 });
    expect(result.map((e) => e.name)).toEqual(["Hexerei: Secret Rite"]);
  });

  it("activates Moonsign and Hexerei effects together, independently", () => {
    const result = computeMoonsignHexereiEffects({ moonsignCount: 2, hexereiCount: 2 });
    expect(result.map((e) => e.name)).toEqual(["Nascent Gleam", "Ascendant Gleam", "Hexerei: Secret Rite"]);
  });
});
