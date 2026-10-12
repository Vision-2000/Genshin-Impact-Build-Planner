// Originally generated from Talent_Scaling_report.txt (summarized from
// https://genshin-impact.fandom.com/wiki/Talent/Level_Scaling, kept in
// data-source/ as a historical reference only, not regenerated from --
// see below).
//
// Manual audit (comparing computed values against the original per-level
// TalentAttribute data) found the wiki's own summary table -- rounded to 3
// decimal places -- wasn't precise enough: multiplying an exact baseValue by
// a 3dp-rounded ratio measurably drifted from the true value for 6 of the 9
// curves (up to ~0.18 percentage points, enough to flip the last displayed
// digit under formatCode F1P/F2P). Elemental1, Elemental1Alternative, and
// BeidouDmgReduction were already exact at the wiki's own precision and are
// unchanged. The other 6 are exact INTEGER ratios (Physical1/Physical2/
// Elemental2/ZhongliBurst -- computed below via division rather than a
// rounded decimal literal, per data-source/master-data-formulas.txt section
// 4's own warning that a 4dp approximation shifts some displayed values by
// 0.1) or, for the 5 trial-only levels with no such integer ratio
// (Physical1Alternative's 11-15), the exact 6dp values from manual audit.
//
// Each array is a ratio curve indexed by talent level - 1 (index 0 = level
// 1, always 1.0). A TalentAttribute's actual value at a given level is
// round(baseValue * curve[level - 1], 6dp) for whichever named curve it
// uses -- see TalentCurveType in schema.prisma and
// computeTalentAttributeValue below.
//
// Verified against all 2880 seeded TalentAttribute rows before being
// trusted as the compact schema's source of truth: 70.3% match one of
// these 9 named curves exactly, 29.1% are constant (no scaling), ~1% are a
// plain linear ramp (not in this named set, handled separately as
// TalentCurveType.Linear), and the remaining <0.5% are genuine one-off
// exceptions stored as raw customValues (TalentCurveType.Custom) -- same
// treatment the wiki itself gives Beidou/Zhongli/Yoimiya.

function fraction(numerators: number[], denominator: number): number[] {
  return numerators.map((n) => n / denominator);
}

export const TALENT_CURVES: Record<string, number[]> = {
  Physical1: fraction([86, 93, 100, 110, 117, 125, 136, 147, 158, 170, 182, 194, 206, 218, 230], 86),
  // Levels 1-10 share Physical1's exact fractions; 11-15 are trial-mode-only
  // and have no such integer ratio, so they're the manually-audited 6dp
  // values directly.
  Physical1Alternative: [
    ...fraction([86, 93, 100, 110, 117, 125, 136, 147, 158, 170], 86),
    2.136628, 2.324651, 2.512674, 2.700698, 2.905814,
  ],
  Physical2: fraction([88, 94, 100, 108, 114, 121, 130, 139, 148, 157, 166, 175, 184, 193, 202], 88),
  Elemental1: [1, 1.075, 1.15, 1.25, 1.325, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.125, 2.25, 2.375],
  Elemental1Alternative: [1, 1.075, 1.15, 1.25, 1.325, 1.4, 1.5, 1.6, 1.7, 1.8, 1.904, 2.04, 2.176, 2.312, 2.448],
  Elemental2: fraction([167, 177, 187, 200, 210, 220, 233, 246, 259, 272, 285, 298, 311, 324, 337], 167),
  EffectFlat: [1, 1.100014, 1.208362, 1.325045, 1.450063, 1.583414, 1.725101, 1.875122, 2.033477, 2.200167, 2.375191, 2.55855, 2.750243, 2.950271, 3.158633],
  BeidouDmgReduction: [1, 1.05, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95],
  ZhongliBurst: fraction([74, 82, 90, 100, 109, 118, 130, 142, 154, 166, 178, 190, 200, 210, 220], 74),
};
