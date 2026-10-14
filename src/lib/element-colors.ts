import { Element } from "@/generated/prisma/enums";

// Each element's own in-game color, same reasoning as rarity-colors.ts.
const ELEMENT_BORDER: Record<Element, string> = {
  [Element.Pyro]: "border-red-400",
  [Element.Hydro]: "border-blue-400",
  [Element.Electro]: "border-purple-400",
  [Element.Cryo]: "border-cyan-400",
  [Element.Anemo]: "border-teal-400",
  [Element.Geo]: "border-amber-400",
  [Element.Dendro]: "border-green-400",
};

// Background half for the small glow badge below (lit constellation icon,
// selected element-picker badge) -- a small accent, not tuned further.
const ELEMENT_GLOW_BACKGROUND: Record<Element, string> = {
  [Element.Pyro]: "bg-red-950",
  [Element.Hydro]: "bg-blue-950",
  [Element.Electro]: "bg-purple-950",
  [Element.Cryo]: "bg-cyan-950",
  [Element.Anemo]: "bg-teal-950",
  [Element.Geo]: "bg-amber-950",
  [Element.Dendro]: "bg-green-950",
};

// Tuned separately from the glow background above -- the progression
// editor's panel background is a much larger, more prominent surface,
// where exact hue/brightness matters more than it does for a small icon
// accent. Most run one shade brighter (900) than the glow badge's 950;
// Dendro is kept at 950 -- a brighter green read wrong.
const ELEMENT_PANEL_BACKGROUND: Record<Element, string> = {
  [Element.Pyro]: "bg-red-900",
  [Element.Hydro]: "bg-blue-900",
  [Element.Electro]: "bg-purple-900",
  [Element.Cryo]: "bg-cyan-900",
  [Element.Anemo]: "bg-teal-900",
  [Element.Geo]: "bg-yellow-900",
  [Element.Dendro]: "bg-green-950",
};

// Border/background pair used for an element's "activated" state -- e.g. a
// lit constellation icon.
export function elementGlowClasses(element: Element): string {
  return `${ELEMENT_BORDER[element]} ${ELEMENT_GLOW_BACKGROUND[element]}`;
}

// The progression editor's overall panel background, tuned per
// ELEMENT_PANEL_BACKGROUND above rather than reusing the glow background.
export function elementBackgroundClass(element: Element): string {
  return ELEMENT_PANEL_BACKGROUND[element];
}
