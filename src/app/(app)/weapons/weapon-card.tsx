"use client";

import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { formatStatValue } from "@/lib/stat-format";
import { defaultWeaponProgression } from "@/lib/weapon-scaling";
import { BoldHighlightedText } from "@/components/bold-highlighted-text";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import type { WeaponHoverDetail } from "./filter-sort";

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
// weapon isn't a boolean: refinement is a real per-copy value, and the
// action (Add vs Remove) differs by context. refinement here is always
// read-only display (the add catalog no longer shows one at all -- editing
// it, like level, now happens in the shared WeaponProgressionForm modal
// both call sites open). `onSelect` makes the whole card the click target,
// used both by the picker ("pick this one") and the add catalog ("open the
// customize-before-adding modal").
export function WeaponCard({
  name,
  weaponType,
  rarity,
  secondaryStatName,
  iconUrl,
  refinement,
  actionLabel,
  onAction,
  danger = false,
  onSelect,
  showName = true,
  showWeaponTypeBadge = true,
  level,
  onEdit,
  isActive = false,
  hoverDetail,
}: {
  name: string;
  weaponType: WeaponType;
  rarity: number;
  secondaryStatName: string | null;
  iconUrl: string | null;
  refinement?: number;
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
  // Add-catalog only -- exact stats/passive at this weapon's own default
  // state (level 90/R1, or whatever defaultWeaponProgression() says for
  // the handful of exceptions), shown via the same MouseFollowTooltip the
  // character progression editor uses for constellation/talent hovers --
  // not a fixed overlay baked into the card itself, which left the passive
  // text cramped (and briefly blocked the card's own Add button, sitting
  // underneath it in the same spot). Undefined everywhere else (owned
  // list, pickers), where this wouldn't mean anything -- those show a real
  // owned copy's CURRENT refinement/level already, on the card face.
  hoverDetail?: WeaponHoverDetail;
}) {
  const cardBody = (
    <div
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      title={hoverDetail ? undefined : name}
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
        // The Add button lives inside this same div (absolutely positioned
        // overlay, not a sibling like ArtifactCard's edit/delete buttons),
        // so a plain hover:opacity-90 would also dim the whole card while
        // hovering the button -- CSS :hover bubbles to ancestors for any
        // hovered descendant. :not(:has(button:hover)) opts the card's own
        // dim-on-hover out specifically while a button inside it is what's
        // being hovered, leaving the button's own hover style the only
        // thing that changes.
        onSelect ? "cursor-pointer [&:hover:not(:has(button:hover))]:opacity-90" : ""
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
            {refinement !== undefined && (
              <span className="rounded border border-white/70 px-1.5 text-xs font-semibold text-white">
                R{refinement}
              </span>
            )}
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction();
                }}
                className={`flex h-6 items-center justify-center rounded px-2 text-xs font-semibold leading-none text-white ${
                  danger ? "bg-red-600" : "border border-white/70 hover:bg-white/25"
                }`}
              >
                {actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Only needed for the hover tooltip below (labeling exactly which state
  // its stats/passive are shown at), computed unconditionally here anyway
  // since it's a cheap, pure lookup -- not worth gating behind hoverDetail.
  const defaultProgression = defaultWeaponProgression(name);

  return (
    <li className="group relative">
      {hoverDetail ? (
        <MouseFollowTooltip
          wrapperClassName="relative block w-full"
          widthClassName="w-[28rem]"
          content={
            <>
              {/* Level pairs with the stats row below it (level is what the
                  base-stat formulas scale on), refinement pairs with the
                  passive name below the divider instead (refinement is
                  what the passive's own numbers scale on) -- not grouped
                  together as one "current state" line. */}
              <div className="flex items-baseline gap-2">
                <p className="text-base font-semibold text-yellow-100">{name}</p>
                <p className="text-base font-semibold text-gray-400">Lv.{defaultProgression.level}</p>
              </div>
              <div className="mt-1 flex items-baseline gap-6">
                <p className="text-base font-semibold text-yellow-100">Base ATK: {hoverDetail.attack}</p>
                {secondaryStatName && hoverDetail.secondaryStatValue !== null && (
                  <p className="text-base font-semibold text-yellow-100">
                    {secondaryStatName}: {formatStatValue(secondaryStatName, hoverDetail.secondaryStatValue)}
                  </p>
                )}
              </div>
              {hoverDetail.passiveName && hoverDetail.passiveDescription && (
                <>
                  <hr className="mt-2 border-gray-700" />
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-base font-semibold text-yellow-100">{hoverDetail.passiveName}</p>
                    <p className="text-base font-semibold text-gray-400">R{defaultProgression.refinement}</p>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-gray-300">
                    <BoldHighlightedText text={hoverDetail.passiveDescription} />
                  </p>
                </>
              )}
            </>
          }
        >
          {cardBody}
        </MouseFollowTooltip>
      ) : (
        cardBody
      )}

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
