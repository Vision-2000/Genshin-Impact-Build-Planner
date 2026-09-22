"use client";

import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { ELEMENT_ICON_URL } from "./element-icons";

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
  level,
  constellation,
}: {
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  onSelect?: () => void;
  isOwned?: boolean;
  // Only the catalog page needs the green/gray ownership distinction at a
  // glance -- the owned page's cards are all owned by definition, so they
  // use the same neutral border WeaponCard/ArtifactCard use.
  showOwnershipBorder?: boolean;
  // Owned-page-only: shown as a second line under the name, mirroring how
  // WeaponCard shows its secondary stat under the weapon name.
  level?: number;
  constellation?: number;
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
        className={`relative aspect-square w-full overflow-hidden rounded-xl border-8 shadow ${
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

        <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
          <Image src={ELEMENT_ICON_URL[element]} alt={element} width={26} height={26} />
        </span>
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
          {level !== undefined && (
            <p className="truncate text-center text-xs text-gray-300">
              Lv. {level}
              {constellation !== undefined && ` · C${constellation}`}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
