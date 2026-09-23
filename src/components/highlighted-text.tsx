import type { ReactNode } from "react";

const ELEMENT_NAMES = ["Pyro", "Hydro", "Electro", "Cryo", "Anemo", "Geo", "Dendro"] as const;
type ElementName = (typeof ELEMENT_NAMES)[number];

function elementTextClass(element: ElementName): string {
  switch (element) {
    case "Pyro":
      return "text-red-400";
    case "Hydro":
      return "text-blue-400";
    case "Electro":
      return "text-purple-400";
    case "Cryo":
      return "text-cyan-300";
    case "Anemo":
      return "text-teal-300";
    case "Geo":
      return "text-amber-300";
    case "Dendro":
      return "text-green-400";
  }
}

const BOLD_TERM_PATTERN = /\*\*(.+?)\*\*/g;
const ELEMENT_PATTERN = `(?:AoE\\s+)?(?:${ELEMENT_NAMES.join("|")})\\s+(?:DMG|damage|RES|resistance)`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Occasionally genshin-db's own markup is malformed -- e.g. Nicole's Skill
// has a stray, unpaired "****" immediately after a correctly-closed
// "**Grace of Kenosis**" (verified against every talent/constellation
// description in the DB: this is the only one). Since there's no matching
// closer anywhere else in the text, that run never matches the bold pattern
// at all and would otherwise leak through as literal asterisks in plain
// text -- stripped here instead of shown.
function stripDanglingAsterisks(value: string): string {
  return value.replace(/\*{2,}/g, "");
}

// genshin-db wraps terms the game itself visually emphasizes -- talent
// names, buff/effect names -- in its own markdown-style "**bold**" markers,
// but only on the FIRST mention within a given description; a later, plain
// repeat of the exact same term (e.g. "Revelation: Uncreated Light"
// mentioned again two sentences later, unmarked) is still highlighted on
// HoYoLAB. So: collect every term bolded anywhere in this text, then treat
// any later unmarked repeat of one of those exact terms the same way.
function buildPattern(text: string): RegExp {
  const boldedTerms = [...text.matchAll(BOLD_TERM_PATTERN)].map((m) => m[1]);
  // Longest-first avoids a shorter term winning at a position where a
  // longer one also starts (rare, but matches HighlightedText's other
  // longest-first alternations).
  const uniqueTerms = [...new Set(boldedTerms)].sort((a, b) => b.length - a.length);

  const alternatives = ["\\*\\*(?<bold>.+?)\\*\\*"];
  if (uniqueTerms.length > 0) {
    alternatives.push(`(?<repeat>${uniqueTerms.map(escapeRegExp).join("|")})`);
  }
  alternatives.push(`(?<element>${ELEMENT_PATTERN})`);

  return new RegExp(alternatives.join("|"), "gi");
}

// Highlights talent/constellation description text the way HoYoLAB does: a
// neutral light yellow for genshin-db's own **bolded** terms (markers
// stripped) and their later unmarked repeats, and the matching element
// color for "<Element> DMG/damage/RES/resistance" phrases (e.g. "AoE Dendro
// DMG", "Anemo resistance").
export function HighlightedText({ text }: { text: string }): ReactNode {
  const pattern = buildPattern(text);
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) nodes.push(stripDanglingAsterisks(text.slice(lastIndex, match.index)));

    const { bold, repeat, element: elementMatch } = match.groups ?? {};
    if (bold !== undefined || repeat !== undefined) {
      nodes.push(
        <span key={key++} className="font-medium text-yellow-100">
          {bold ?? repeat}
        </span>
      );
    } else if (elementMatch !== undefined) {
      const element = ELEMENT_NAMES.find((name) => elementMatch.toLowerCase().includes(name.toLowerCase()));
      nodes.push(
        <span key={key++} className={`font-medium ${element ? elementTextClass(element) : ""}`}>
          {elementMatch}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(stripDanglingAsterisks(text.slice(lastIndex)));

  return nodes;
}
