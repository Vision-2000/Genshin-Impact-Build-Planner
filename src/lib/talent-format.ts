import { computeTalentAttributeValue, type TalentCurveType } from "./talent-scaling";

// Renders one TalentAttribute value for display, given the format-code
// convention in data-source/master-data-formulas.txt section 4 (e.g. "F1P"
// = one decimal place, shown as a percentage; "F0" = a whole number; "I" =
// an integer, rounded half-up).
export function formatTalentValue(value: number, formatCode: string): string {
  // Rounded half-up, not truncated -- needed for EffectFlat rows, whose
  // stored values have decimals (e.g. 770.3755, 930.89) but display as
  // plain integers (770, 931). Math.round already rounds half-up for every
  // value this sees (talent values are never negative).
  if (formatCode === "I") return String(Math.round(value));

  let scaled = value;
  if (formatCode.includes("P")) scaled *= 100;

  const text = formatCode.includes("F") ? scaled.toFixed(Number(formatCode[1])) : String(scaled);

  return formatCode.includes("P") ? `${text}%` : text;
}

// A genshin-db label combining multiple params (e.g. "Low/High Plunge
// DMG|{param10:P}/{param11:P}") gets split at seed time into multiple
// TalentAttribute rows -- "Low/High Plunge DMG (1)", "Low/High Plunge DMG
// (2)" -- since the schema stores one curve per row (see
// prisma/seed.ts's parseAttributeLabel). Regrouped back here into one
// display row per base label ("Low/High Plunge DMG: 113.6%/141.9%") rather
// than showing "(1)"/"(2)" as if they were two unrelated attributes.
export function groupTalentAttributes(
  attributes: {
    label: string;
    formatCode: string;
    curveType: string;
    baseValue: number;
    linearSlope: number | null;
    capLevel: number | null;
    customValues: number[];
  }[],
  level: number
): { label: string; display: string }[] {
  const groups: { label: string; values: string[] }[] = [];
  for (const attribute of attributes) {
    const label = attribute.label.replace(/ \(\d+\)$/, "");
    const value = computeTalentAttributeValue(
      {
        curveType: attribute.curveType as TalentCurveType,
        baseValue: attribute.baseValue,
        linearSlope: attribute.linearSlope,
        capLevel: attribute.capLevel,
        customValues: attribute.customValues.length > 0 ? attribute.customValues : null,
      },
      level
    );
    const formatted = formatTalentValue(value, attribute.formatCode);

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.values.push(formatted);
    } else {
      groups.push({ label, values: [formatted] });
    }
  }
  return groups.map((g) => ({ label: g.label, display: g.values.join("/") }));
}
