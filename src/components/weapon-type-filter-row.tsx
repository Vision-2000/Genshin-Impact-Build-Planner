"use client";

import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";

const WEAPON_TYPES = Object.values(WeaponType);

export function WeaponTypeFilterRow({
  weaponTypeFilter,
  onToggle,
}: {
  weaponTypeFilter: ReadonlySet<WeaponType>;
  onToggle: (weaponType: WeaponType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {WEAPON_TYPES.map((weaponType) => (
        <button
          key={weaponType}
          type="button"
          onClick={() => onToggle(weaponType)}
          aria-pressed={weaponTypeFilter.has(weaponType)}
          title={weaponType}
          className={`h-10 w-10 rounded-full ring-2 ${
            weaponTypeFilter.has(weaponType) ? "ring-blue-500" : "ring-foreground"
          }`}
        >
          <Image
            src={WEAPON_TYPE_ICON_URL[weaponType]}
            alt={weaponType}
            width={40}
            height={40}
            className="rounded-full"
          />
        </button>
      ))}
    </div>
  );
}
