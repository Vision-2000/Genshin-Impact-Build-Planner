import { TALENT_CURVES } from "./talent-curves";

// The curve family a TalentAttribute's 15-value array follows. Covers the
// 9 curves named in Talent_Scaling_report.txt, a "Linear" family the
// report doesn't name but which real data clearly follows (a plain ramp,
// simpler than any of the 9 -- just a base value and a slope), "Constant"
// for attributes that don't scale with level at all, and "Custom" as an
// escape hatch for the small residual (<1% of all seeded attributes) that
// fit none of the above -- same treatment the wiki itself gives named
// one-off exceptions like Beidou/Zhongli/Yoimiya. Yoimiya's own
// "(value-1) follows Elemental 2" quirk (see the report's worked example)
// isn't auto-detected as its own curve type: a naive version of that check
// also matched Wanderer's and Wriothesley's superficially similar but
// actually-different attributes, so those few rows are simplest and safest
// left as Custom rather than chasing a more precise heuristic for
// something this rare.
export type TalentCurveType = keyof typeof TALENT_CURVES | "Linear" | "Constant" | "Custom";

export type TalentAttributeCurve = {
  curveType: TalentCurveType;
  baseValue: number;
  // Only set for TalentCurveType.Linear -- the ratio increment per level
  // (unlike the named curves, which share one universal ratio table, a
  // linear ramp's rate genuinely differs per attribute, so this has to be
  // stored per row).
  linearSlope: number | null;
  // Only set for TalentCurveType.Linear when the ramp stops partway and
  // the rest of the (mostly trial-mode-only) range 11-15 stays flat at
  // whatever value the line had reached -- e.g. Chongyun's "Infusion
  // Duration" ramps linearly through level 11, then holds flat. Null
  // means the line runs the full 15 levels with no cap.
  capLevel: number | null;
  // Only set for TalentCurveType.Custom -- the raw 15 values, unchanged.
  customValues: number[] | null;
};

function closeEnough(a: number, b: number, tolerancePct = 0.01): boolean {
  const diff = Math.abs(a - b);
  return diff <= tolerancePct || diff <= tolerancePct * Math.abs(b);
}

function matchesNamedCurve(ratios: number[], curve: number[]): boolean {
  const n = Math.min(ratios.length, curve.length);
  for (let i = 0; i < n; i++) {
    if (!closeEnough(ratios[i], curve[i])) return false;
  }
  return true;
}

// Finds where a ratio sequence stops following its own initial slope and
// goes flat instead, if it ever does. capLevel is the LAST level that still
// follows the line (every later level repeats that same value) -- e.g. a
// sequence linear through index 10 (level 11) and flat from index 11
// (level 12) on reports capLevel: 11, not 12. Returns "full" if it runs
// all 15 levels with no cap, or null if it doesn't fit a line at all.
function fitLinear(ratios: number[]): { kind: "full" | "capped"; capLevel: number | null } | null {
  const step = ratios[1] - ratios[0];
  let capIndex = -1;
  for (let i = 0; i < ratios.length; i++) {
    if (closeEnough(ratios[i], ratios[0] + step * i)) continue;
    capIndex = i;
    break;
  }
  if (capIndex === -1) return { kind: "full", capLevel: null };
  const plateauValue = ratios[capIndex];
  const restIsFlat = ratios.slice(capIndex).every((r) => closeEnough(r, plateauValue));
  return restIsFlat ? { kind: "capped", capLevel: capIndex } : null; // capIndex (0-based) == the last matching level in 1-based terms
}

// Classifies one TalentAttribute's raw 15-value array (genshin-db's own
// per-level samples) into the compact curve representation. Used once at
// seed time -- never at read time, where computeTalentAttributeValue below
// is used instead.
export function classifyTalentAttributeCurve(values: number[]): TalentAttributeCurve {
  const baseValue = values[0];

  if (values.every((v) => closeEnough(v, baseValue, 1e-9))) {
    return { curveType: "Constant", baseValue, linearSlope: null, capLevel: null, customValues: null };
  }

  const ratios = values.map((v) => v / baseValue);

  for (const [name, curve] of Object.entries(TALENT_CURVES)) {
    if (matchesNamedCurve(ratios, curve)) {
      return { curveType: name as TalentCurveType, baseValue, linearSlope: null, capLevel: null, customValues: null };
    }
  }

  const linearFit = fitLinear(ratios);
  if (linearFit) {
    return {
      curveType: "Linear",
      baseValue,
      linearSlope: ratios[1] - ratios[0],
      capLevel: linearFit.capLevel,
      customValues: null,
    };
  }

  return { curveType: "Custom", baseValue, linearSlope: null, capLevel: null, customValues: values };
}

// The inverse: given a stored curve + a talent level, returns the actual
// value -- used at read time (the progression editor's multiplier tooltip)
// instead of indexing into a stored array.
export function computeTalentAttributeValue(curve: TalentAttributeCurve, level: number): number {
  const index = level - 1;

  switch (curve.curveType) {
    case "Constant":
      return curve.baseValue;

    case "Custom":
      return curve.customValues![Math.min(index, curve.customValues!.length - 1)];

    case "Linear": {
      // capLevel (1-based) is the last level that still follows the line,
      // i.e. the last valid 0-based index is capLevel - 1.
      const effectiveIndex = curve.capLevel !== null ? Math.min(index, curve.capLevel - 1) : index;
      return curve.baseValue * (1 + curve.linearSlope! * effectiveIndex);
    }

    default: {
      const ratioCurve = TALENT_CURVES[curve.curveType];
      const ratio = ratioCurve[Math.min(index, ratioCurve.length - 1)];
      return curve.baseValue * ratio;
    }
  }
}
