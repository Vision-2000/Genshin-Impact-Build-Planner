import type { ReactNode } from "react";
import { Element } from "@/generated/prisma/enums";
import { elementTextClass } from "@/lib/element-colors";

// Character talent/constellation descriptions only -- the master data
// (data-source/characters.json) now carries Lunaris's own highlight tags
// directly in the text (<gold> for section headings/key terms/names,
// one tag per element for "<Element> DMG/RES" phrases), replacing the
// old genshin-db "**bold**" markers this app used to re-derive its own
// highlighting from (see BoldHighlightedText's comment -- that heuristic
// is gone for characters, not just simplified). Every occurrence Lunaris
// tagged is already tagged, exactly once, never nested -- there's
// nothing left to infer, just a straight tag -> color lookup. Element
// colors live in @/lib/element-colors, not duplicated here, so every
// element-color choice in the app is defined in one place; gold isn't an
// element, so it stays local here. #FFD780 is Lunaris's own <gold> hex
// (handoff section 11), used directly rather than approximated with a
// Tailwind yellow shade.
const GOLD_TEXT_CLASS = "font-medium text-[#FFD780]";

const TAG_CLASS: Record<string, string> = {
  gold: GOLD_TEXT_CLASS,
  pyro: elementTextClass(Element.Pyro),
  hydro: elementTextClass(Element.Hydro),
  electro: elementTextClass(Element.Electro),
  cryo: elementTextClass(Element.Cryo),
  anemo: elementTextClass(Element.Anemo),
  geo: elementTextClass(Element.Geo),
  dendro: elementTextClass(Element.Dendro),
};

const TAG_PATTERN = new RegExp(`<(${Object.keys(TAG_CLASS).join("|")})>(.*?)<\\/\\1>`, "g");

export function TaggedText({ text }: { text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(TAG_PATTERN)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, tag, content] = match;
    nodes.push(
      <span key={key++} className={TAG_CLASS[tag]}>
        {content}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}
