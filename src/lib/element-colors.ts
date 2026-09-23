import { Element } from "@/generated/prisma/enums";

// Maps a character's element to the border/background pair used for its
// "activated" state -- e.g. a lit constellation icon -- matching each
// element's own in-game color, same reasoning as rarity-colors.ts.
export function elementGlowClasses(element: Element): string {
  switch (element) {
    case Element.Pyro:
      return "border-red-400 bg-red-950";
    case Element.Hydro:
      return "border-blue-400 bg-blue-950";
    case Element.Electro:
      return "border-purple-400 bg-purple-950";
    case Element.Cryo:
      return "border-cyan-400 bg-cyan-950";
    case Element.Anemo:
      return "border-teal-400 bg-teal-950";
    case Element.Geo:
      return "border-amber-400 bg-amber-950";
    case Element.Dendro:
      return "border-green-400 bg-green-950";
  }
}
