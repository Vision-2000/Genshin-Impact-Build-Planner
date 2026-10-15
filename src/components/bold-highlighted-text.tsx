import type { ReactNode } from "react";

// Weapon passive text only: renderWeaponPassiveDescription (see
// @/lib/weapon-refinement-scaling) wraps each inserted refinement-scaled
// value in **markers**, and this renders those spans in a light blue --
// verified in-game: nothing else in a weapon's passive text is
// highlighted, only the numbers that scale with refinement.
//
// This used to also highlight every occurrence of the weapon's own
// passive name and any "<Element> DMG/RES" phrase, plus strip stray
// genshin-db markup -- all of that was inherited wholesale from the
// character-talent heuristic this component originally shared with
// Characters, not something ever actually true for weapons. Characters
// now get their highlighting directly from Lunaris's own tags (see
// TaggedText) instead of a heuristic, which is also what surfaced that
// the weapon side was carrying rules it never needed.
const BOLD_TERM_PATTERN = /\*\*(.+?)\*\*/g;

export function BoldHighlightedText({ text }: { text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(BOLD_TERM_PATTERN)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <span key={key++} className="font-medium text-sky-400">
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}
