"use client";

import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { REFINEMENTS } from "./filter-sort";

// Shared visual card for the owned-weapons list, the add-weapon catalog, and
// weapon pickers -- same rarity-gradient/badge/overlay treatment as the
// Characters cards. Not a single click-to-toggle button by default, since a
// weapon isn't a boolean: refinement is a real per-copy value the user
// picks, and the action (Add vs Remove) differs by context. `onSelect` is
// the exception -- a picker just needs "pick this one," so the whole card
// becomes the click target and refinement (if given at all) is read-only.
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
  onSelect,
}: {
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
  refinement?: number;
  onRefinementChange?: (refinement: number) => void;
  actionLabel?: string;
  onAction?: () => void;
  danger?: boolean;
  onSelect?: () => void;
}) {
  return (
    <li>
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect();
              }
            : undefined
        }
        className={`relative aspect-square w-full overflow-hidden rounded-xl border-8 border-gray-600 shadow ${
          onSelect ? "cursor-pointer hover:opacity-90" : ""
        } ${rarityGradientClasses(rarity)}`}
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
          {(refinement !== undefined || actionLabel) && (
            <div className="flex items-center justify-center gap-2">
              {refinement !== undefined &&
                (onRefinementChange ? (
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
                ) : (
                  <span className="rounded border border-white/70 px-1.5 text-xs font-semibold text-white">
                    R{refinement}
                  </span>
                ))}
              {actionLabel && onAction && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction();
                  }}
                  className={`flex h-6 items-center justify-center rounded px-2 text-xs font-semibold leading-none text-white ${
                    danger ? "bg-red-600" : "border border-white/70 hover:bg-white/10"
                  }`}
                >
                  {actionLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
