"use client";

import { WeaponType } from "@/generated/prisma/enums";

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
          className={`rounded-full border px-3 py-1 text-xs ${
            weaponTypeFilter.has(weaponType) ? "bg-foreground text-background" : ""
          }`}
        >
          {weaponType}
        </button>
      ))}
    </div>
  );
}
