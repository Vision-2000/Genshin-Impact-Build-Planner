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

// The splash-art column's own background in the character progression
// editor -- hand-tuned by hex (easier to nudge directly than hopping
// between named Tailwind shades), one per element. Started from this
// project's actual Tailwind v4 red-900/blue-900/etc. (converted from
// their OKLCH definitions in node_modules/tailwindcss/theme.css) before
// being adjusted further by eye.
const ELEMENT_PANEL_BACKGROUND: Record<Element, string> = {
  [Element.Pyro]: "bg-[#751907]", 
  [Element.Hydro]: "bg-[#09438D]", 
  [Element.Electro]: "bg-[#31005B]", 
  [Element.Cryo]: "bg-[#005175]",
  [Element.Anemo]: "bg-[#006163]", 
  [Element.Geo]: "bg-[#773F00]", 
  [Element.Dendro]: "bg-[#126B30]", 
};

// Plain text color for an element's own name/DMG/RES mentions (TaggedText's
// <pyro>/<hydro>/etc. tags). A shade lighter (300) than ELEMENT_BORDER's
// 400 for Cryo/Anemo/Geo specifically. Tried Lunaris's own hex here
// directly instead -- reverted, preferred this version on a direct
// side-by-side check.
const ELEMENT_TEXT: Record<Element, string> = {
  [Element.Pyro]: "text-red-400",
  [Element.Hydro]: "text-blue-400",
  [Element.Electro]: "text-purple-400",
  [Element.Cryo]: "text-cyan-300",
  [Element.Anemo]: "text-teal-300",
  [Element.Geo]: "text-amber-300",
  [Element.Dendro]: "text-green-400",
};

// Border/background pair used for an element's "activated" state -- e.g. a
// lit constellation icon.
export function elementGlowClasses(element: Element): string {
  return `${ELEMENT_BORDER[element]} ${ELEMENT_GLOW_BACKGROUND[element]}`;
}

// The progression editor's splash-art column background, tuned per
// ELEMENT_PANEL_BACKGROUND above rather than reusing the glow background.
export function elementBackgroundClass(element: Element): string {
  return ELEMENT_PANEL_BACKGROUND[element];
}

export function elementTextClass(element: Element): string {
  return `font-medium ${ELEMENT_TEXT[element]}`;
}
