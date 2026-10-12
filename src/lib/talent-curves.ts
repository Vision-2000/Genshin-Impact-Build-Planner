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
// digit under formatCode F1P/F2P). Physical1, Physical1Alternative,
// Physical2, Elemental2, EffectFlat, and ZhongliBurst below were replaced
// with higher-precision values (source: manual audit, not the wiki report
// above) that reproduce the original per-level data to within ~0.0002
// percentage points (EffectFlat, used for large flat values, to within
// ~0.09 absolute) -- see data-source/master-data-formulas.txt for the
// verification writeup. Elemental1, Elemental1Alternative, and
// BeidouDmgReduction were already exact at the wiki's own precision and are
// unchanged.
//
// Each array is a ratio curve indexed by talent level - 1 (index 0 = level
// 1, always 1.0). A TalentAttribute's actual value at a given level is
// baseValue * curve[level - 1] for whichever named curve it uses -- see
// TalentCurveType in schema.prisma and computeTalentAttributeValue below.
//
// Verified against all 2880 seeded TalentAttribute rows before being
// trusted as the compact schema's source of truth: 70.3% match one of
// these 9 named curves exactly, 29.1% are constant (no scaling), ~1% are a
// plain linear ramp (not in this named set, handled separately as
// TalentCurveType.Linear), and the remaining <0.5% are genuine one-off
// exceptions stored as raw customValues (TalentCurveType.Custom) -- same
// treatment the wiki itself gives Beidou/Zhongli/Yoimiya.

export const TALENT_CURVES: Record<string, number[]> = {
  Physical1: [1, 1.0814, 1.1628, 1.2791, 1.3605, 1.4535, 1.5814, 1.7093, 1.8372, 1.9767, 2.1163, 2.2558, 2.3953, 2.5349, 2.6744],
  Physical1Alternative: [1, 1.0814, 1.1628, 1.2791, 1.3605, 1.4535, 1.5814, 1.7093, 1.8372, 1.9767, 2.1366, 2.3247, 2.5127, 2.7007, 2.9058],
  Physical2: [1, 1.0682, 1.1364, 1.2273, 1.2955, 1.375, 1.4773, 1.5795, 1.6818, 1.7841, 1.8864, 1.9886, 2.0909, 2.1932, 2.2955],
  Elemental1: [1, 1.075, 1.15, 1.25, 1.325, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.125, 2.25, 2.375],
  Elemental1Alternative: [1, 1.075, 1.15, 1.25, 1.325, 1.4, 1.5, 1.6, 1.7, 1.8, 1.904, 2.04, 2.176, 2.312, 2.448],
  Elemental2: [1, 1.0599, 1.1198, 1.1976, 1.2575, 1.3174, 1.3952, 1.4731, 1.5509, 1.6287, 1.7066, 1.7844, 1.8623, 1.9401, 2.018],
  EffectFlat: [1, 1.1, 1.2084, 1.325, 1.4501, 1.5834, 1.7251, 1.8751, 2.0335, 2.2002, 2.3752, 2.5585, 2.7502, 2.9503, 3.1586],
  BeidouDmgReduction: [1, 1.05, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95],
  ZhongliBurst: [1, 1.1081, 1.2162, 1.3514, 1.473, 1.5946, 1.7568, 1.9189, 2.0811, 2.2432, 2.4054, 2.5676, 2.7027, 2.8378, 2.973],
};
