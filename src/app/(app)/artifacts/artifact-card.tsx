"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { formatStatValue } from "@/lib/stat-format";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";

// Shared visual card for the owned-artifacts list, the add-artifact
// catalog, and the build creation/editing artifact picker -- same
// rarity-gradient-square/badge/overlay treatment WeaponCard uses. Two
// different ways to show more than the icon alone, used by different call
// sites depending on whether they deal with one piece/set at a time or a
// whole grid to compare:
// - mainStatName/substats: a plain stat block always visible below the
//   icon, picker-only (see ArtifactSlotPicker's own comment) -- picking a
//   build artifact means telling several same-set pieces apart at a
//   glance, which a hover tooltip can't do for more than one card at once.
// - tooltipContent: the owned list's (that piece's own main stat/
//   substats) and the add-catalog's (the set's 2pc/4pc effect text) own
//   hover detail, shown via the same MouseFollowTooltip WeaponCard uses --
//   fine there since those two only ever deal with one piece/set at a
//   time, not a side-by-side comparison.
// Never both at once in practice, though nothing enforces that at the
// type level.
export function ArtifactCard({
  setName,
  slot,
  rarity,
  iconUrl,
  level,
  mainStatName,
  substats,
  actionLabel,
  onAction,
  danger = false,
  onSelect,
  showSetName = true,
  showSlotBadge = true,
  tooltipContent,
}: {
  setName: string;
  // Optional -- the add-catalog deals in sets, not pieces, so slot isn't
  // known yet (it's chosen inside the add modal). showSlotBadge only ever
  // renders once a real slot is given.
  slot?: ArtifactSlot;
  rarity: number;
  iconUrl: string | null;
  // Owned-artifacts list and picker only.
  level?: number;
  mainStatName?: string;
  substats?: { statTypeName: string; value: number }[];
  actionLabel?: string;
  onAction?: () => void;
  danger?: boolean;
  onSelect?: () => void;
  showSetName?: boolean;
  showSlotBadge?: boolean;
  tooltipContent?: ReactNode;
}) {
  // The picker's own stat block needs the icon area to stay shorter
  // (aspect-[4/3]) so two cards' worth of stat text underneath don't push
  // the grid too tall; everyone else (owned list, catalog) has no stat
  // block below at all, so the icon area gets the full WeaponCard-style
  // aspect-square treatment instead.
  const hasStatBlock = mainStatName !== undefined;

  const cardBody = (
    <div
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      title={tooltipContent ? undefined : setName}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelect();
            }
          : undefined
      }
      className={`relative w-full overflow-hidden rounded-xl border-8 border-gray-600 shadow ${
        hasStatBlock ? "aspect-[4/3]" : "aspect-square"
      } ${
        // Same :not(:has(button:hover)) trick as WeaponCard -- the action
        // button lives inside this same div, so a plain hover:opacity-90
        // would also dim the whole card while hovering the button.
        onSelect ? "cursor-pointer [&:hover:not(:has(button:hover))]:opacity-90" : ""
      } ${rarityGradientClasses(rarity)}`}
    >
      {iconUrl && (
        <Image
          src={iconUrl}
          alt={setName}
          fill
          sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
          className="object-contain p-4"
        />
      )}

      {showSlotBadge && slot && (
        <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
          <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt={slot} width={26} height={26} />
        </span>
      )}

      {level !== undefined && (
        <span className="absolute right-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow">
          <span className="mt-0.5 text-sm font-semibold leading-none text-white">+{level}</span>
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
        {showSetName && <p className="truncate text-center text-sm font-semibold text-white">{setName}</p>}
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
    <li className="@container relative">
      {tooltipContent ? (
        <MouseFollowTooltip wrapperClassName="relative block w-full" content={tooltipContent}>
          {cardBody}
        </MouseFollowTooltip>
      ) : (
        cardBody
      )}

      {hasStatBlock && (
        <div className="bg-background px-2 py-1.5">
          <p className="-mx-2 mb-2.5 truncate bg-foreground/10 px-2 pb-1 pt-1.5 text-xs text-foreground">
            <span className="text-gray-400">MAIN STAT:</span> <span className="font-semibold">{mainStatName}</span>
          </p>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400">Substats</p>
          <div className="grid min-h-[4.5rem] grid-cols-1 gap-x-2 gap-y-1 @[18rem]:min-h-[2.5rem] @[18rem]:grid-cols-2">
            {(substats ?? []).map((substat) => (
              <p key={substat.statTypeName} className="truncate text-[11px] leading-tight text-foreground/75">
                {substat.statTypeName} +{formatStatValue(substat.statTypeName, substat.value)}
              </p>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
