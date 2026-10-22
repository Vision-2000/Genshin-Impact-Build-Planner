"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";

// Shared visual card for the owned-artifacts list, the add-artifact
// catalog, and the build creation/editing artifact picker -- same
// rarity-gradient-square/badge/overlay treatment WeaponCard uses, down to
// mainStatName's own position (bottom gradient overlay, under the name)
// matching WeaponCard's secondaryStatName exactly. Substat detail (and,
// for the add-catalog, 2pc/4pc effect text) is hover-only, via
// tooltipContent -- same MouseFollowTooltip WeaponCard uses for its own
// hoverDetail.
export function ArtifactCard({
  setName,
  slot,
  rarity,
  iconUrl,
  level,
  mainStatName,
  actionLabel,
  onAction,
  danger = false,
  onSelect,
  showSetName = true,
  showSlotBadge = true,
  tooltipContent,
  selected,
  borderClassName = "border-8 border-gray-600",
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
  // Owned-artifacts list and picker only -- same bottom-overlay text line
  // WeaponCard's own secondaryStatName renders, just the stat's name, no
  // value (the value needs level+rarity to compute, which varies by call
  // site -- tooltipContent is where callers that already have it show it).
  mainStatName?: string;
  actionLabel?: string;
  onAction?: () => void;
  danger?: boolean;
  onSelect?: () => void;
  showSetName?: boolean;
  showSlotBadge?: boolean;
  tooltipContent?: ReactNode;
  // Owned-artifacts page's bulk-delete select mode only -- same red-border
  // treatment as WeaponCard's own `selected` prop (see its own comment).
  selected?: boolean;
  // Overridable for a caller that wants no border (or a different one) on
  // the ordinary (selected === undefined) state -- e.g. BuildCatalog's own
  // compact artifact slot, where the usual 8px border reads as too heavy
  // at a much smaller box size. Has no effect once `selected` is set --
  // bulk-delete's own red/gray distinction always wins there.
  borderClassName?: string;
}) {
  // Same loaded-flag/spinner-overlay technique as SplashImage (not reused
  // directly -- that component hardcodes sizes="100vw" and a plain
  // object-fit className, neither of which fits this card's own tailored
  // sizes/padding), since a freshly-added set's icon has no browser cache
  // to fall back on and otherwise renders nothing at all while it loads.
  // key={iconUrl} resets this back to "not loaded" if the card is ever
  // reused for a different icon.
  const [loaded, setLoaded] = useState(false);

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
      aria-pressed={selected !== undefined ? selected : undefined}
      className={`relative aspect-square w-full overflow-hidden rounded-xl shadow ${
        // Same :not(:has(button:hover)) trick as WeaponCard -- the action
        // button lives inside this same div, so a plain hover:opacity-90
        // would also dim the whole card while hovering the button.
        onSelect ? "cursor-pointer [&:hover:not(:has(button:hover))]:opacity-90" : ""
      } ${
        // selected !== undefined means bulk-delete select mode -- its own
        // red/gray border always wins there; borderClassName only applies
        // to the ordinary state.
        selected === undefined ? borderClassName : selected ? "border-8 border-red-500" : "border-8 border-gray-600"
      } ${rarityGradientClasses(rarity)}`}
    >
      {iconUrl && (
        <>
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity ${loaded ? "opacity-0" : "opacity-100"}`}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
          <Image
            key={iconUrl}
            src={iconUrl}
            alt={setName}
            fill
            sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
            className="object-contain p-4"
            onLoad={() => setLoaded(true)}
          />
        </>
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
        {(showSetName || mainStatName) && (
          <div>
            {showSetName && <p className="truncate text-center text-sm font-semibold text-white">{setName}</p>}
            {mainStatName && <p className="truncate text-center text-xs text-gray-300">{mainStatName}</p>}
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
      {tooltipContent ? (
        // widthClassName widened from the default w-80 -- the substat grid
        // (2 columns of "Name +Value" text, e.g. "Energy Recharge% +5.8")
        // was wrapping names onto a second line at that width. Same
        // w-[28rem] WeaponCard's own tooltip already uses, for the same
        // "enough room for a full stat line" reasoning.
        <MouseFollowTooltip wrapperClassName="relative block w-full" widthClassName="w-[28rem]" content={tooltipContent}>
          {cardBody}
        </MouseFollowTooltip>
      ) : (
        cardBody
      )}
    </li>
  );
}
