"use client";

import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { characterMaxLevelForAscensionPhase } from "@/lib/ascension";
import { ELEMENT_ICON_URL } from "./element-icons";

// Owned-page-only progression snapshot -- always passed as one object since
// it's all-or-nothing (the roster/catalog page never has any of it).
export type CharacterCardProgression = {
  level: number;
  ascensionPhase: number;
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
};

// Shared visual card for the owned-characters page and the add-character
// catalog -- same rarity-gradient/badge/overlay treatment as
// Weapons/Artifacts. `onSelect` means something different in each context
// (toggle ownership on the catalog; open the progression editor on the
// owned page), so this component doesn't know or care which -- it just
// makes the whole card the click target either way.
export function CharacterCard({
  name,
  element,
  weaponType,
  rarity,
  iconUrl,
  onSelect,
  isOwned,
  showOwnershipBorder = false,
  progression,
}: {
  name: string;
  // Undefined only for the collapsed Traveler-gender roster card, which
  // spans all 7 elements at once -- no single element badge applies there.
  element?: Element;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  onSelect?: () => void;
  isOwned?: boolean;
  // Only the catalog page needs the green/gray ownership distinction at a
  // glance -- the owned page's cards are all owned by definition, so they
  // use the same neutral border WeaponCard/ArtifactCard use.
  showOwnershipBorder?: boolean;
  // Owned-page-only. The card face only ever shows the level (mirroring how
  // WeaponCard shows its secondary stat under the weapon name); the rest
  // (constellation, talent levels) is hover-only -- see the overlay below.
  progression?: CharacterCardProgression;
}) {
  return (
    <li>
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        title={name}
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect();
              }
            : undefined
        }
        aria-pressed={showOwnershipBorder ? isOwned : undefined}
        className={`group relative aspect-square w-full overflow-hidden rounded-xl border-8 shadow ${
          onSelect ? "cursor-pointer hover:opacity-90" : ""
        } ${showOwnershipBorder ? (isOwned ? "border-green-500" : "border-gray-600") : "border-gray-600"} ${rarityGradientClasses(rarity)}`}
      >
        {iconUrl && (
          <Image
            src={iconUrl}
            alt={name}
            fill
            sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
            className="object-cover"
          />
        )}

        {element && (
          <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
            <Image src={ELEMENT_ICON_URL[element]} alt={element} width={26} height={26} />
          </span>
        )}
        <span className="absolute right-2 top-2 h-9 w-9 rounded-full shadow">
          <Image
            src={WEAPON_TYPE_ICON_URL[weaponType]}
            alt={weaponType}
            width={36}
            height={36}
            className="rounded-full"
          />
        </span>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-8">
          <p className="truncate text-center text-lg font-semibold text-white">{name}</p>
          {progression && <p className="truncate text-center text-xs text-gray-300">Lv. {progression.level}</p>}
        </div>

        {progression && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/85 p-2 text-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <p className="text-sm font-semibold text-white">
              Lv. {progression.level}/{characterMaxLevelForAscensionPhase(progression.ascensionPhase)}
            </p>
            <p className="text-sm text-gray-200">Constellation {progression.constellation}</p>
            <p className="text-xs text-gray-300">Normal Attack: Lv.{progression.normalAttackLevel}</p>
            <p className="text-xs text-gray-300">Elemental Skill: Lv.{progression.skillLevel}</p>
            <p className="text-xs text-gray-300">Elemental Burst: Lv.{progression.burstLevel}</p>
          </div>
        )}
      </div>
    </li>
  );
}
