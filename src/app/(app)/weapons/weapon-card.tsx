"use client";

import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { REFINEMENTS } from "./filter-sort";

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 2.5l3 3L6 13l-3.5 1L4 10.5z" />
    </svg>
  );
}

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
  showName = true,
  showWeaponTypeBadge = true,
  level,
  onEdit,
  isActive = false,
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
  // The choose-weapon picker's grid is dense enough (up to 5 columns) that
  // the name mostly just truncates -- it's still available on hover via the
  // title attribute below. The other two call sites (owned weapons,
  // add-weapon catalog) keep the visible name.
  showName?: boolean;
  // Every candidate in the picker already matches the character's own
  // weapon type (see WeaponSlotPicker), so the badge would never say
  // anything the user doesn't already know there.
  showWeaponTypeBadge?: boolean;
  // Only the owned-weapons page provides these -- level/ascension needs
  // more room than fits inline (unlike refinement, a single dropdown), so
  // it's edited in a modal instead, same pattern as ArtifactCard's
  // edit/delete. The level badge and edit button share the same top-right
  // corner, swapping via hover exactly like ArtifactCard's level badge does.
  level?: number;
  onEdit?: () => void;
  isActive?: boolean;
}) {
  return (
    <li className="group relative">
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
        className={`relative aspect-square w-full overflow-hidden rounded-xl border-8 border-gray-600 shadow ${
          onSelect ? "cursor-pointer hover:opacity-90" : ""
        } ${rarityGradientClasses(rarity)}`}
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

        {showWeaponTypeBadge && (
          <span className="absolute left-2 top-2 h-9 w-9 rounded-full shadow">
            <Image
              src={WEAPON_TYPE_ICON_URL[weaponType]}
              alt={weaponType}
              width={36}
              height={36}
              className="rounded-full"
            />
          </span>
        )}

        {level !== undefined && (
          <span
            className={`absolute right-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow transition-transform duration-200 group-hover:translate-y-6 group-focus-within:translate-y-6 ${
              isActive ? "translate-y-6" : ""
            }`}
          >
            <span className="mt-0.5 text-sm font-semibold leading-none text-white">Lv.{level}</span>
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
          {(showName || secondaryStatName) && (
            <div>
              {showName && <p className="truncate text-center text-base font-semibold text-white">{name}</p>}
              {secondaryStatName && (
                <p className="truncate text-center text-xs text-gray-300">{secondaryStatName}</p>
              )}
            </div>
          )}
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

      {onEdit && (
        <div
          className={`absolute right-1.5 top-1.5 z-20 flex gap-1 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
            isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-black"
          >
            <PencilIcon />
          </button>
        </div>
      )}
    </li>
  );
}
