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

// Shared visual card for the owned-weapons list, the add-weapon catalog, and
// weapon pickers -- same rarity-gradient/badge/overlay treatment as the
// Characters cards. Not a single click-to-toggle button by default, since a
// weapon isn't a boolean: refinement is a real per-copy value, and the
// action (Add vs Delete) differs by context. refinement here is always
// read-only display (the add catalog no longer shows one at all -- editing
// it, like level, now happens in the shared WeaponProgressionForm modal
// both call sites open). `onSelect` makes the whole card the click target
// -- used by the picker ("pick this one"), the add catalog ("open the
// customize-before-adding modal"), and the owned-weapons list ("open the
// edit modal"); the owned list and catalog both additionally pass
// actionLabel/onAction for a quick one-click action (Delete / Add) that
// doesn't require opening that modal at all.
// The hover tooltip's own content -- extracted out of WeaponCard so the
// weapons bulk-delete confirmation's MiniatureCard rows can show the exact
// same detail on hover without duplicating this JSX a second time.
export function WeaponHoverCardContent({
  name,
  secondaryStatName,
  level,
  refinement,
  hoverDetail,
}: {
  name: string;
  secondaryStatName: string | null;
  level?: number;
  refinement?: number;
  hoverDetail: WeaponHoverDetail;
}) {
  // Only needed for the hover tooltip, to label exactly which state its
  // stats/passive are shown at. The owned-weapons page always passes its own
  // real level/refinement props (that copy's actual current state); the
  // add-catalog passes neither, so this falls back to the weapon's own
  // defaultWeaponProgression() state there.
  const defaultProgression = defaultWeaponProgression(name);
  const tooltipLevel = level ?? defaultProgression.level;
  const tooltipRefinement = refinement ?? defaultProgression.refinement;

  return (
    <>
      {/* Level pairs with the stats row below it (level is what the
          base-stat formulas scale on), refinement pairs with the passive
          name below the divider instead (refinement is what the passive's
          own numbers scale on) -- not grouped together as one "current
          state" line. */}
      <div className="flex items-baseline gap-2">
        <p className="text-base font-semibold text-yellow-100">{name}</p>
        <p className="text-base font-semibold text-gray-400">Lv.{tooltipLevel}</p>
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
            <p className="text-base font-semibold text-gray-400">R{tooltipRefinement}</p>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-gray-300">
            <BoldHighlightedText text={hoverDetail.passiveDescription} />
          </p>
        </>
      )}
    </>
  );
}

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
  hoverDetail,
  selected,
  borderClassName = "border-8 border-gray-600",
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
  // false only for the build weapon picker's own compact SELECTED display
  // (WeaponSlotPicker) -- that box now renders small (see BuildCatalog/
  // BuildEditor's own SLOT_SIZE_CLASS), with no room for a name alongside
  // the icon; the full name is still one hover away via hoverDetail. Every
  // other call site (owned weapons, add-weapon catalog, the picker's own
  // modal grid) keeps it, truncating at this card's own dense grid sizes
  // same as everywhere else.
  showName?: boolean;
  // Every candidate in the picker already matches the character's own
  // weapon type (see WeaponSlotPicker), so the badge would never say
  // anything the user doesn't already know there.
  showWeaponTypeBadge?: boolean;
  // Owned-weapons page only -- shown as a plain top-right badge. Also
  // undefined for the build weapon picker's own compact selected display
  // now, same "no room, it's one hover away" reasoning as showName above.
  level?: number;
  // Both the owned-weapons page (this copy's own current level/
  // ascension/refinement) and the add-catalog (this weapon's own
  // defaultWeaponProgression() state) provide this, shown via the same
  // MouseFollowTooltip the character progression editor uses for
  // constellation/talent hovers -- not a fixed overlay baked into the
  // card itself, which left the passive text cramped (and briefly
  // blocked the card's own action button, sitting underneath it in the
  // same spot). Undefined for pickers' own modal grid, where this wouldn't
  // mean anything extra beyond the refinement/level already on the card
  // face -- but the build weapon picker's own compact selected display
  // (WeaponSlotPicker) DOES still pass this, now its only source of detail
  // once level/refinement/name are gone from the card face itself.
  hoverDetail?: WeaponHoverDetail;
  // Owned-weapons page's bulk-delete select mode only -- same red-border
  // treatment CharacterCard's showOwnershipBorder uses for green, just a
  // different color since this marks "about to delete", not "owned".
  // Undefined everywhere else, which keeps the ordinary neutral border.
  selected?: boolean;
  // Overridable for a caller that wants no border (or a different one) on
  // the ordinary (selected === undefined) state -- e.g. BuildCatalog's own
  // compact weapon slot, where the usual 8px border reads as too heavy at
  // a much smaller box size. Has no effect once `selected` is set -- bulk-
  // delete's own red/gray distinction always wins there.
  borderClassName?: string;
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
      aria-pressed={selected !== undefined ? selected : undefined}
      className={`relative aspect-square w-full overflow-hidden rounded-xl shadow ${
        // The Add button lives inside this same div (absolutely positioned
        // overlay, not a sibling like ArtifactCard's edit/delete buttons),
        // so a plain hover:opacity-90 would also dim the whole card while
        // hovering the button -- CSS :hover bubbles to ancestors for any
        // hovered descendant. :not(:has(button:hover)) opts the card's own
        // dim-on-hover out specifically while a button inside it is what's
        // being hovered, leaving the button's own hover style the only
        // thing that changes.
        onSelect ? "cursor-pointer [&:hover:not(:has(button:hover))]:opacity-90" : ""
      } ${
        // selected !== undefined means bulk-delete select mode -- its own
        // red/gray border always wins there; borderClassName only applies
        // to the ordinary state.
        selected === undefined ? borderClassName : selected ? "border-8 border-red-500" : "border-8 border-gray-600"
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

      {/* Level moves to top-left (alone) when there's no weapon-type badge
          sharing that corner (every build-picker call site --
          showWeaponTypeBadge is always false there), refinement to
          top-right (alone) -- otherwise both stay grouped at top-right,
          same as before, since top-left is already taken by the
          weapon-type badge on the owned-weapons page and add-catalog. */}
      {!showWeaponTypeBadge && level !== undefined && (
        <span className="absolute left-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow">
          <span className="mt-0.5 text-sm font-semibold leading-none text-white">Lv.{level}</span>
        </span>
      )}

      {(refinement !== undefined || (showWeaponTypeBadge && level !== undefined)) && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {showWeaponTypeBadge && level !== undefined && (
            <span className="flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow">
              <span className="mt-0.5 text-sm font-semibold leading-none text-white">Lv.{level}</span>
            </span>
          )}
          {refinement !== undefined && (
            <span className="flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow">
              <span className="mt-0.5 text-sm font-semibold leading-none text-white">R{refinement}</span>
            </span>
          )}
        </div>
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
        {actionLabel && onAction && (
          <div className="flex items-center justify-center">
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
          </div>
        )}
      </div>
    </div>
  );

  return (
    <li className="relative">
      {hoverDetail ? (
        <MouseFollowTooltip
          wrapperClassName="relative block w-full"
          widthClassName="w-[28rem]"
          content={
            <WeaponHoverCardContent
              name={name}
              secondaryStatName={secondaryStatName}
              level={level}
              refinement={refinement}
              hoverDetail={hoverDetail}
            />
          }
        >
          {cardBody}
        </MouseFollowTooltip>
      ) : (
        cardBody
      )}
    </li>
  );
}
