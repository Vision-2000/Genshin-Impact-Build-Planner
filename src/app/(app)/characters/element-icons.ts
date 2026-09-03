import { Element } from "@/generated/prisma/enums";

// Extracted once from genshin-db's own embedded base64 icons (see
// prisma/seed.ts's icon-sourcing notes) into public/icons -- there are only
// ever 7 elements, so these are static local files rather than fetched from
// any external CDN. Zero dead-link risk, no network dependency at runtime.
export const ELEMENT_ICON_URL: Record<Element, string> = {
  [Element.Anemo]: "/icons/element-anemo.png",
  [Element.Cryo]: "/icons/element-cryo.png",
  [Element.Dendro]: "/icons/element-dendro.png",
  [Element.Electro]: "/icons/element-electro.png",
  [Element.Geo]: "/icons/element-geo.png",
  [Element.Hydro]: "/icons/element-hydro.png",
  [Element.Pyro]: "/icons/element-pyro.png",
};
