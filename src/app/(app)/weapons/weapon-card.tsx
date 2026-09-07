"use client";

import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { REFINEMENTS } from "./filter-sort";

// Shared visual card for both the owned-weapons list and the add-weapon
// catalog -- same rarity-gradient/badge/overlay treatment as the Characters
// cards, but not a single click-to-toggle button, since a weapon isn't a
// boolean: refinement is a real per-copy value the user picks, and the
// action (Add vs Remove) differs by context.
export function WeaponCard({
  name,
  weaponType,
  rarity,
  secondaryStatName,
  iconUrl,
  refinement,
  onRefinementChange,
  actionLabel,
  onAction,
  danger = false,
}: {
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
  refinement: number;
  onRefinementChange: (refinement: number) => void;
  actionLabel: string;
  onAction: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-xl border-8 border-gray-600 shadow ${rarityGradientClasses(rarity)}`}
      >
        {iconUrl && (
          <Image
            src={iconUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
            className="object-cover"
          />
        )}

        <span className="absolute left-2 top-2 h-9 w-9 rounded-full shadow">
          <Image
            src={WEAPON_TYPE_ICON_URL[weaponType]}
            alt={weaponType}
            width={36}
            height={36}
            className="rounded-full"
          />
        </span>

        <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
          <div>
            <p className="truncate text-center text-base font-semibold text-white">{name}</p>
            {secondaryStatName && (
              <p className="truncate text-center text-xs text-gray-300">{secondaryStatName}</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <select
              value={refinement}
              onChange={(event) => onRefinementChange(Number(event.target.value))}
              className="h-6 rounded border bg-white px-1.5 text-xs text-black"
            >
              {REFINEMENTS.map((r) => (
                <option key={r} value={r}>
                  R{r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAction}
              className={`flex h-6 items-center justify-center rounded px-2 text-xs font-semibold leading-none text-white ${
                danger ? "bg-red-600" : "border border-white/70 hover:bg-white/10"
              }`}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
