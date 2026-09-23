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
// but only on the FIRST mention within a given description, and not even
// consistently then: Bennett's C6 mentions "Fantastic Voyage" (his own
// Burst's name) with no ** anywhere in that description at all, yet
// HoYoLAB still highlights it. So this combines two sources of "known
// neutral names" for one description: genshin-db's own bolded terms in
// THIS text (catches buff/effect names that aren't talent names at all,
// e.g. "Grace of Kenosis"), plus every one of the character's own talent
// names, passed in regardless of whether genshin-db ever bolded them here
// (catches cases like Bennett's C6 that markers alone miss). Either way,
// every occurrence of a name in this combined set gets highlighted, not
// just the first.
function buildPattern(text: string, talentNames: string[]): RegExp {
  const boldedTerms = [...text.matchAll(BOLD_TERM_PATTERN)].map((m) => m[1]);
  // Longest-first avoids a shorter term winning at a position where a
  // longer one also starts (rare, but matches HighlightedText's other
  // longest-first alternations).
  const neutralNames = [...new Set([...boldedTerms, ...talentNames])].filter(Boolean).sort((a, b) => b.length - a.length);

  const alternatives = ["\\*\\*(?<bold>.+?)\\*\\*"];
  if (neutralNames.length > 0) {
    alternatives.push(`(?<repeat>${neutralNames.map(escapeRegExp).join("|")})`);
  }
  alternatives.push(`(?<element>${ELEMENT_PATTERN})`);

  return new RegExp(alternatives.join("|"), "gi");
}

// Highlights talent/constellation description text the way HoYoLAB does: a
// neutral light yellow for genshin-db's own **bolded** terms (markers
// stripped), every occurrence of the character's own talent names, and the
// matching element color for "<Element> DMG/damage/RES/resistance" phrases
// (e.g. "AoE Dendro DMG", "Anemo resistance"). `talentNames` should be
// every one of the character's own talent names, not just the talent this
// particular description belongs to -- one talent's description commonly
// references another by name (e.g. a Burst referencing the Normal Attack
// it empowers).
export function HighlightedText({ text, talentNames }: { text: string; talentNames: string[] }): ReactNode {
  const pattern = buildPattern(text, talentNames);
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
