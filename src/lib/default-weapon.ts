import { WeaponType } from "@/generated/prisma/enums";

// Every character always has SOME weapon equipped in-game -- there's no
// "unarmed" state, and a fresh account's characters start on their type's
// own basic 1-star starter weapon. A build with no real weapon chosen
// (Build.ownedWeaponId null) represents exactly that default state, not
// "no weapon" -- so it's shown and totaled as this weapon, not as an empty
// slot.
//
// These are NOT real Weapon/OwnedWeapon rows: this app's seed deliberately
// excludes 1-2 star weapons entirely (see CLAUDE.md, "no meaningful build
// relevance"), and a default weapon is never owned, leveled, ascended, or
// refined -- there's nothing to store progression on, so baseAttack below
// is the only value that ever matters, not a base-plus-ascension-curve pair
// the way a real Weapon's `baseAttack`/`attackTier` is. No secondary stat,
// no passive -- confirmed true in-game for every 1-star weapon.
//
// icon files were supplied directly (not sourced through prisma/seed.ts's
// usual genshin-db/wiki pipeline, since these weapons were never part of
// that import) and dropped into public/icons alongside the other static
// icon sets (element/weapon-type/artifact-slot) this app already serves
// the same way.
export type DefaultWeapon = {
  name: string;
  iconUrl: string;
  baseAttack: number;
};

export const DEFAULT_WEAPON_RARITY = 1;

export const DEFAULT_WEAPON: Record<WeaponType, DefaultWeapon> = {
  [WeaponType.Sword]: { name: "Dull Blade", iconUrl: "/icons/weapon-sword-base.webp", baseAttack: 23 },
  [WeaponType.Claymore]: { name: "Waster Greatsword", iconUrl: "/icons/weapon-claymore-base.webp", baseAttack: 23 },
  [WeaponType.Polearm]: { name: "Beginner's Protector", iconUrl: "/icons/weapon-polearm-base.webp", baseAttack: 23 },
  [WeaponType.Catalyst]: { name: "Apprentice's Notes", iconUrl: "/icons/weapon-catalyst-base.webp", baseAttack: 23 },
  [WeaponType.Bow]: { name: "Hunter's Bow", iconUrl: "/icons/weapon-bow-base.webp", baseAttack: 23 },
};
