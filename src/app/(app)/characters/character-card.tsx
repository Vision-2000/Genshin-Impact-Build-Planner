"use client";

import { useState } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { characterLevelDisplayCap } from "@/lib/ascension";
import { ELEMENT_ICON_URL } from "./element-icons";

// Owned-page-only progression snapshot -- always passed as one object since
// it's all-or-nothing (the roster/catalog page never has any of it).
export type CharacterCardProgression = {
  level: number;
  ascensionPhase: number;
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
};

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
  progression,
  borderClassName = "border-8 border-gray-600",
}: {
  name: string;
  // Undefined only for the collapsed Traveler-gender roster card, which
  // spans all 7 elements at once -- no single element badge applies there.
  element?: Element;
  weaponType: WeaponType;
  rarity: number;
  iconUrl: string | null;
  onSelect?: () => void;
  isOwned?: boolean;
  // Only the catalog page needs the green/gray ownership distinction at a
  // glance -- the owned page's cards are all owned by definition, so they
  // use the same neutral border WeaponCard/ArtifactCard use.
  showOwnershipBorder?: boolean;
  // Owned-page-only. The card face only ever shows the level (mirroring how
  // WeaponCard shows its secondary stat under the weapon name); the rest
  // (constellation, talent levels) is hover-only -- see the overlay below.
  progression?: CharacterCardProgression;
  // Overridable for a caller that wants no border (or a different one) on
  // the ordinary (showOwnershipBorder === false) state -- e.g. a build's
  // character picker modal, where the usual thick gray border reads as
  // heavier than WeaponCard/ArtifactCard's own modal grids now go for. Has
  // no effect once showOwnershipBorder is true -- the roster's own
  // green/gray distinction always wins there. Same borderClassName pattern
  // WeaponCard/ArtifactCard already use (the full border classes, width
  // included, not just a color) -- "" removes the border entirely rather
  // than just thinning it.
  borderClassName?: string;
}) {
  // A freshly-started dev server (or just a cold browser cache) has never
  // fetched this icon before, and Image renders nothing at all while it's
  // in flight -- on a page with 100+ of these at once (the roster), that
  // reads as a wall of blank cards. A spinner over the empty space, same
  // treatment as the progression editor's splash art, says something's
  // actually loading rather than broken.
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <li>
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        title={progression ? undefined : name}
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
        className={`group relative aspect-square w-full overflow-hidden rounded-xl shadow ${
          onSelect ? "cursor-pointer hover:opacity-90" : ""
        } ${
          showOwnershipBorder ? (isOwned ? "border-8 border-green-500" : "border-8 border-gray-600") : borderClassName
        } ${rarityGradientClasses(rarity)}`}
      >
        {iconUrl && (
          <>
            {/* Always rendered, never conditionally removed -- opacity
                toggled by a class instead, so the very first client render
                (imageLoaded still false, same as the server) produces an
                identical tree. Structurally adding/removing this node based
                on load state caused a hydration mismatch for any image that
                happened to resolve from cache fast enough to flip
                imageLoaded before hydration's diff settled. */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${imageLoaded ? "opacity-0" : "opacity-100"}`}
            >
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            </div>
            <Image
              src={iconUrl}
              alt={name}
              fill
              sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
              className="object-cover"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        )}

        {element && (
          <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
            <Image src={ELEMENT_ICON_URL[element]} alt={element} width={26} height={26} />
          </span>
        )}
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
          {progression && <p className="truncate text-center text-xs text-gray-300">Lv. {progression.level}</p>}
        </div>

        {progression && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/85 p-2 text-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <p className="text-sm font-semibold text-white">
              Lv. {progression.level}/{characterLevelDisplayCap(progression.level, progression.ascensionPhase)}
            </p>
            {/* Constellation/talent levels are per-element -- level/ascension
                is all that's shared across a Traveler gender, so the
                collapsed card (no single `element`) only shows that much. */}
            {element && (
              <>
                <p className="text-sm text-gray-200">Constellation {progression.constellation}</p>
                <p className="text-xs text-gray-300">Normal Attack: Lv.{progression.normalAttackLevel}</p>
                <p className="text-xs text-gray-300">Elemental Skill: Lv.{progression.skillLevel}</p>
                <p className="text-xs text-gray-300">Elemental Burst: Lv.{progression.burstLevel}</p>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
