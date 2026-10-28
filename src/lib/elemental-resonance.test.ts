import { describe, it, expect } from "vitest";
import { Element } from "@/generated/prisma/enums";
import { computeElementalResonances } from "./elemental-resonance";

describe("computeElementalResonances", () => {
  it("returns nothing for an empty team", () => {
    expect(computeElementalResonances([])).toEqual([]);
  });

  it("returns nothing when no element appears twice", () => {
    expect(computeElementalResonances([Element.Pyro, Element.Hydro, Element.Electro])).toEqual([]);
  });

  it("activates a single element's resonance once it appears twice", () => {
    const result = computeElementalResonances([Element.Pyro, Element.Pyro, Element.Hydro]);
    expect(result.map((r) => r.name)).toEqual(["Fervent Flames"]);
  });

  it("activates both resonances for a 2/2 split, in canonical element order", () => {
    const result = computeElementalResonances([Element.Electro, Element.Pyro, Element.Pyro, Element.Electro]);
    // Pyro before Electro -- the enum's own declaration order, not the
    // order these elements happened to appear in the input.
    expect(result.map((r) => r.name)).toEqual(["Fervent Flames", "High Voltage"]);
  });

  it("doesn't double-count a 3-of-one-element team as anything more than that one resonance", () => {
    const result = computeElementalResonances([Element.Cryo, Element.Cryo, Element.Cryo, Element.Anemo]);
    expect(result.map((r) => r.name)).toEqual(["Shattering Ice"]);
  });

  it("activates Protective Canopy for a full team of 4 unique elements", () => {
    const result = computeElementalResonances([Element.Pyro, Element.Hydro, Element.Electro, Element.Cryo]);
    expect(result.map((r) => r.name)).toEqual(["Protective Canopy"]);
  });

  it("does not activate Protective Canopy with only 3 unique elements, even on a full team", () => {
    // Can't actually happen with 4 team slots (3 unique elements across 4
    // builds means at least one pair shares an element, which would
    // activate that element's own resonance instead) -- covered anyway
    // as a direct test of the "exactly 4 distinct" condition itself.
    const result = computeElementalResonances([Element.Pyro, Element.Hydro, Element.Electro, Element.Pyro]);
    expect(result.map((r) => r.name)).toEqual(["Fervent Flames"]);
  });

  it("does not activate Protective Canopy with 4 unique elements on a team smaller than 4", () => {
    const result = computeElementalResonances([Element.Pyro, Element.Hydro, Element.Electro]);
    expect(result).toEqual([]);
  });
});
