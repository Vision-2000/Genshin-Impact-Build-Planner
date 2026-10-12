import { TALENT_CURVES } from "./talent-curves";

// The curve family a TalentAttribute's per-level value follows. Covers the
// 9 curves named in Talent_Scaling_report.txt, a "Linear" family the
// report doesn't name but which real data clearly follows (a plain ramp,
// simpler than any of the 9 -- just a base value and a slope), "Constant"
// for attributes that don't scale with level at all, and "Custom" as an
// escape hatch for the small residual that fits none of the above -- same
// treatment the wiki itself gives named one-off exceptions like Beidou/
// Zhongli/Yoimiya. Classification into one of these happens upstream, in
// characters.json itself (hand-maintained against Lunaris/Project
// Amber/HoYoWiki) -- this module only reconstructs a value from the
// already-classified curve at read time.
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

// Given a stored curve + a talent level, returns the actual value -- used
// at read time (the progression editor's multiplier tooltip) instead of
// indexing into a stored array.
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
      // Rounded to 6dp, matching how the game itself stores each level's
      // value -- some attributes land exactly on a display-rounding
      // boundary (e.g. 0.8085 -> 80.85% -> "80.9%") and depend on this
      // happening before formatTalentValue's own rounding, not after.
      const ratioCurve = TALENT_CURVES[curve.curveType];
      const ratio = ratioCurve[Math.min(index, ratioCurve.length - 1)];
      return Math.round(curve.baseValue * ratio * 1e6) / 1e6;
    }
  }
}
