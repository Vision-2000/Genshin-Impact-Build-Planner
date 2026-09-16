// Renders one TalentAttribute value for display, given genshin-db's own
// format-code convention (e.g. "F1P" = one decimal place, shown as a
// percentage; "F0" = a whole number; "I" = an integer, used as-is).
//
// Mirrors genshin-db's own reference implementation
// (node_modules/genshin-db/src/helper.js, helper.formatTalentLabels) rather
// than reinventing the convention -- that function re-parses a whole label
// string against a live {parameters} object, since it's meant to format an
// arbitrary talent level on demand from the raw genshin-db data. We instead
// store one already-looked-up value per (attribute, level) in
// TalentAttribute.values at seed time, so this only needs to do the
// value -> string half of that logic.
export function formatTalentValue(value: number, formatCode: string): string {
  if (formatCode === "I") return String(value);

  let scaled = value;
  if (formatCode.includes("P")) scaled *= 100;

  const text = formatCode.includes("F") ? scaled.toFixed(Number(formatCode[1])) : String(scaled);

  return formatCode.includes("P") ? `${text}%` : text;
}
