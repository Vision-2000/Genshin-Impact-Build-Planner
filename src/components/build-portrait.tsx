"use client";

import { useState } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { DEFAULT_WEAPON, DEFAULT_WEAPON_RARITY } from "@/lib/default-weapon";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import type { ActiveSetEffectItem } from "@/lib/active-set-effects";
import { ELEMENT_ICON_URL } from "../app/(app)/characters/element-icons";
import { ArtifactSetEffectsIcon } from "./artifact-set-effects-icon";

// Shared "character icon beside weapon+artifact-effects icons" content --
// used by the Builds page's own BuildCard and the Teams page's build-slot
// card (build-slot-picker.tsx), both of which want a build's full equipped
// loadout visible at a glance, not just its character. A 3-wide/2-tall
// rectangle: the character icon is 2x2 units (w-2/3, aspect-square), the
// weapon+artifact-effects icons stacked beside it are 1x1 units each
// (w-1/3, aspect-square, flush with no gap so their combined height
// matches the character icon's own). Only the inner content -- sizing
// (the outer box's own width/aspect ratio), the clickable shell, its
// border/rarity-gradient background, and any active-state styling are all
// the caller's own concern, same as ArtifactSetEffectsIcon leaves its own
// sizing/shape to its caller.
export function BuildPortrait({
  characterIconUrl,
  characterElement,
  buildName,
  characterName,
  weaponIconUrl,
  weaponRarity,
  characterWeaponType,
  activeSetEffects,
}: {
  characterIconUrl: string | null;
  characterElement: Element;
  buildName: string;
  characterName: string;
  weaponIconUrl: string | null;
  weaponRarity: number | null;
  characterWeaponType: WeaponType;
  activeSetEffects: ActiveSetEffectItem[];
}) {
  // Same loaded-flag/spinner-overlay technique as CharacterCard/
  // ArtifactCard/WeaponCard -- a freshly-started dev server (or just a cold
  // browser cache) has never fetched this portrait before, and Image
  // renders nothing at all while it's in flight, reading as a wall of
  // blank cards on a page full of these.
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      {/* border-r-2 border-white -- separates the 3 icon regions so they
          read as distinct tiles instead of blurring into one shape now
          that they sit flush against each other (no gap, no individual
          rounded corners of their own). Same thin-white-border convention
          as the Build/Weapon/Artifact slot cards elsewhere in this app,
          and now the same color as the diagonal set-effect divider
          below too. */}
      <div className="relative aspect-square w-2/3 shrink-0 border-r-2 border-white">
        {characterIconUrl && (
          <>
            {/* Always rendered, never conditionally removed -- opacity
                toggled by a class instead, so the very first client
                render (imageLoaded still false, same as the server)
                produces an identical tree. Structurally adding/removing
                this node based on load state caused a hydration mismatch
                for any image that happened to resolve from cache fast
                enough to flip imageLoaded before hydration's diff
                settled. */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${imageLoaded ? "opacity-0" : "opacity-100"}`}
            >
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            </div>
            <Image
              src={characterIconUrl}
              alt=""
              fill
              sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
              className="object-cover"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        )}

        {/* Same element badge CharacterCard itself shows -- dropped when
            this layout first replaced CharacterCard for the Teams page's
            build-slot card, then asked back since the character's own
            element is still useful to see at a glance even once the
            weapon/artifact-effects icons are showing beside it. */}
        <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
          <Image src={ELEMENT_ICON_URL[characterElement]} alt={characterElement} width={26} height={26} />
        </span>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
          <p className="truncate text-center text-sm font-semibold text-white">{buildName}</p>
          <p className="truncate text-center text-xs text-gray-300">{characterName}</p>
        </div>
      </div>

      <div className="flex w-1/3 flex-col">
        {/* No real weapon chosen falls back to the character's own 1-star
            starter weapon -- same as WeaponSlotPicker's empty state (see
            DEFAULT_WEAPON's own comment), not a blank slot. No rounded of
            its own -- this tile's own corners are clipped by the outer
            card's own overflow-hidden rounded corner instead, same as the
            character icon's own square already is. border-b-2 border-white
            -- same reasoning as the character icon's own border-r-2 above,
            between this and the artifact-effects tile below it. */}
        <div
          className={`relative aspect-square w-full border-b-2 border-white ${rarityGradientClasses(
            weaponIconUrl ? weaponRarity ?? 1 : DEFAULT_WEAPON_RARITY
          )}`}
        >
          <Image src={weaponIconUrl ?? DEFAULT_WEAPON[characterWeaponType].iconUrl} alt="" fill className="object-contain p-1" />
        </div>

        {/* ArtifactSetEffectsIcon only renders position:absolute fill
            content -- this wrapper is what actually gives it its square
            shape and clips the diagonal-split case's own triangles to it. */}
        <div className="relative aspect-square w-full overflow-hidden">
          <ArtifactSetEffectsIcon activeSetEffects={activeSetEffects} />
        </div>
      </div>
    </>
  );
}
