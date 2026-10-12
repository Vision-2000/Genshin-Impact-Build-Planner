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

  // Plain "P" (no F prefix) still always displays as a whole percent --
  // the game rounds half-up to 0 decimals despite data-source/
  // master-data-formulas.txt's "no fixed decimal count" phrasing (e.g.
  // Xiao's Plunge DMG Lv1, 0.818335, displays "82%", not "81.8335%"; his
  // Low/High Plunge DMG shows "164%/204%", not fractional). The only
  // non-"F" code that reaches here is "P" itself ("I" already returned
  // above), so this is unconditionally 0 decimals, not formatCode-derived.
  const text = formatCode.includes("F") ? scaled.toFixed(Number(formatCode[1])) : scaled.toFixed(0);

  return formatCode.includes("P") ? `${text}%` : text;
}

export type TalentAttributeForGrouping = {
  label: string;
  formatCode: string;
  curveType: string;
  baseValue: number;
  linearSlope: number | null;
  capLevel: number | null;
  customValues: number[];
  order: number;
  hitCount: number;
  prefix: string | null;
  suffix: string | null;
};

// A label's trailing marker says whether (and how) it joins with sibling
// rows that share the same base label -- checked against ONLY the very
// last "(...)" group in the label (a greedy regex backtrack naturally
// gives us this: "Phantasm Performance 1-Hit DMG (Nefer) (Part 1)" matches
// with base "...(Nefer)", the earlier bracket staying part of the name).
// Any other trailing bracket -- (Press), (Hold), (Shades), (Ranged) -- is
// just part of the name: no marker, no grouping, the label is the row.
// Checked against the full real dataset before trusting these 4 patterns
// as exhaustive: every bracket-suffixed label not covered by one of them
// is one of exactly those 4 name-text cases.
type Joiner = "+" | "/" | "-";
// partPrefix is only set for "(N Character)"/"(N Characters)" -- unlike
// every other marker, the marker text itself ("1 Character", "2
// Characters") is meaningful per-part context the game actually shows
// ("1 Character 10%/2 Characters 20%"), not just a split instruction to
// discard once grouping is resolved.
type LabelMarker = { baseLabel: string; joiner: Joiner; partPrefix?: string } | null;

function parseLabelMarker(label: string): LabelMarker {
  let match = label.match(/^(.*) \(Part \d+\)$/);
  if (match) return { baseLabel: match[1], joiner: "+" };

  // "(N Character)"/"(N Characters)" (Nahida's Burst only) has to be
  // checked before the plain "(N)" pattern below, since neither pattern
  // would otherwise ambiguously match the other's text.
  match = label.match(/^(.*) \((\d+ Characters?)\)$/);
  if (match) return { baseLabel: match[1], joiner: "/", partPrefix: match[2] };

  match = label.match(/^(.*) \(\d+\)$/);
  if (match) return { baseLabel: match[1], joiner: "/" };

  // Literal "(min)"/"(max)" (Kirara/Sayu/Tartaglia's CDs) -- a range the
  // game shows as "A - B", so a dash renders it more naturally than "/".
  match = label.match(/^(.*) \((?:min|max)\)$/);
  if (match) return { baseLabel: match[1], joiner: "-" };

  return null;
}

type AttributePart = {
  order: number;
  value: number;
  formatCode: string;
  hitCount: number;
  prefix: string;
  suffix: string;
};

function renderPart(part: AttributePart): string {
  return `${part.prefix}${formatTalentValue(part.value, part.formatCode)}${part.suffix}`;
}

// A part's own suffix already carries whatever trailing unit text the row
// needs where it needs it (e.g. Bennett's Skill CD "(1)"/"(2)"/"(3)" are
// suffixed null/null/"s" -- the game shows the unit once, at the end, not
// on every part) -- nothing extra to do here beyond rendering each part
// faithfully.
function renderGroup(parts: AttributePart[], joiner: Joiner): string {
  // "+" rows where every part shares the same (non-1) hitCount factor it
  // out instead of repeating it per part: Alhaitham's 2-/3-Mirror
  // Projection Attack DMG and Varka's Azure Devour DMG render "(A+B)×N",
  // not "A×N+B×N". A "+" row where hitCount is uniformly 1 (the common
  // case) falls through to the plain join below, same as a mismatched
  // hitCount would (not something currently in the data, but there's no
  // single shared multiplier to factor out there either).
  if (joiner === "+" && parts.length > 1 && parts.every((p) => p.hitCount === parts[0].hitCount) && parts[0].hitCount !== 1) {
    return `(${parts.map(renderPart).join("+")})×${parts[0].hitCount}`;
  }
  // "/" and "-" rows (and any standalone attribute, grouped alone) carry
  // the ×N on each part individually, e.g. Clorinde's Impale the Night
  // DMG "(1)/(2)/(3)" where only the 3rd part hits 3 times.
  return parts.map((p) => (p.hitCount === 1 ? renderPart(p) : `${renderPart(p)}×${p.hitCount}`)).join(joiner);
}

// The JSON stores one TalentAttribute row per labeled part of what the
// game shows as a single value (e.g. "Low/High Plunge DMG" is really two
// rows, "(1)" and "(2)"); this reassembles them into one display row per
// base label, in `order`, rather than showing "(1)"/"(2)" as if they were
// two unrelated attributes. See parseLabelMarker above for exactly which
// trailing bracket counts as a split marker (vs. plain name text like
// "(Press)"/"(Hold)", which never groups).
export function groupTalentAttributes(
  attributes: TalentAttributeForGrouping[],
  level: number
): { label: string; display: string }[] {
  const groups = new Map<string, { baseLabel: string; joiner: Joiner; parts: AttributePart[] }>();
  const groupOrder: string[] = [];

  for (const attribute of attributes) {
    const marker = parseLabelMarker(attribute.label);
    const baseLabel = marker ? marker.baseLabel : attribute.label;
    // Ungrouped attributes never hit the "+"-collapse branch above (their
    // own hitCount, if not 1, still needs its own ×N) -- "/" degenerates
    // to the same single-element join either way.
    const joiner = marker ? marker.joiner : "/";
    const key = `${baseLabel}\u0000${joiner}`;

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

    if (!groups.has(key)) {
      groups.set(key, { baseLabel, joiner, parts: [] });
      groupOrder.push(key);
    }
    groups.get(key)!.parts.push({
      order: attribute.order,
      value,
      formatCode: attribute.formatCode,
      hitCount: attribute.hitCount,
      prefix: (marker?.partPrefix ? `${marker.partPrefix} ` : "") + (attribute.prefix ?? ""),
      suffix: attribute.suffix ?? "",
    });
  }

  return groupOrder.map((key) => {
    const group = groups.get(key)!;
    const parts = [...group.parts].sort((a, b) => a.order - b.order);
    return { label: group.baseLabel, display: renderGroup(parts, group.joiner) };
  });
}
