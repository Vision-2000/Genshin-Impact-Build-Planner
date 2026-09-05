import { WeaponType } from "@/generated/prisma/enums";

// Downloaded once from the Genshin Impact Fandom wiki's static asset CDN
// (static.wikia.nocookie.net -- the wiki pages themselves sit behind a
// Cloudflare bot challenge, but its image CDN doesn't) into public/icons.
// There are only ever 5 weapon types, so these are static local files rather
// than fetched at runtime. Shared across Characters (which shows a
// character's weapon type as a badge) and Weapons (where it's the subject).
export const WEAPON_TYPE_ICON_URL: Record<WeaponType, string> = {
  [WeaponType.Sword]: "/icons/weapon-sword.png",
  [WeaponType.Claymore]: "/icons/weapon-claymore.png",
  [WeaponType.Polearm]: "/icons/weapon-polearm.png",
  [WeaponType.Bow]: "/icons/weapon-bow.png",
  [WeaponType.Catalyst]: "/icons/weapon-catalyst.png",
};
