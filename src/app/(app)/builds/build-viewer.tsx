"use client";

import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { DEFAULT_WEAPON, DEFAULT_WEAPON_RARITY } from "@/lib/default-weapon";
import { WeaponCard } from "../weapons/weapon-card";
import { ArtifactCard } from "../artifacts/artifact-card";
import { CharacterSlotPicker } from "./character-slot-picker";
import { BuildStatsSummary } from "./build-stats-summary";
import { buildTooltipContent } from "./artifact-slot-picker";
import type { OwnedCharacterOption, OwnedWeaponOption, OwnedArtifactOption } from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
// Same value as BuildEditor's own EDITOR_SLOT_SIZE_CLASS
// (owned-build-manager.tsx) -- this is meant to look identical to it, not
// a different size.
const SLOT_SIZE_CLASS = "aspect-square w-full";

// Read-only counterpart to BuildEditor (owned-build-manager.tsx) -- same
// character-splash/weapon/artifacts/stats layout, built from the same
// WeaponSlotPicker/ArtifactSlotPicker's own SELECTED-state cards
// (WeaponCard/ArtifactCard directly, not those pickers themselves, which
// carry search/sort/modal state this has no use for) rather than a
// simplified stand-in. Every slot's own click-to-open affordance is gone
// simply by never passing onSelect -- the same "omit it entirely for a
// non-interactive render" contract WeaponCard/ArtifactCard already support
// for other read-only call sites, not a new prop invented for this one. No
// name field, no Save/Delete row -- this never mutates anything.
export function BuildViewer({
  character,
  weapon,
  artifacts,
  weaponConflict = false,
  conflictingArtifactIds = [],
}: {
  character: OwnedCharacterOption;
  weapon: OwnedWeaponOption | null;
  artifacts: OwnedArtifactOption[];
  // Teams page only (team-manager.tsx's own computeTeamConflicts), passed
  // through BuildDetailModal -- true/non-empty when this build's own
  // weapon/artifact is currently shared with another build in the team
  // "View" was opened from. Both default to false/empty for any other
  // caller.
  weaponConflict?: boolean;
  conflictingArtifactIds?: number[];
}) {
  return (
    <div className="flex w-full flex-col sm:flex-row">
      <CharacterSlotPicker
        characters={[character]}
        value={character.ownedCharacterId}
        onChange={() => {}}
        locked
      />

      {/* Same px-4 pb-2 pt-2 BuildEditor's own column uses -- see its own
          comment on why pb-2 (not pb-4) specifically: it lines
          BuildStatsSummary's own stretched bottom edge up with the splash
          art's, not 8px short of it. */}
      <div className="flex flex-1 flex-col gap-4 px-4 pb-2 pt-2">
        <div className="grid grid-cols-6 gap-4">
          <div className="col-span-1">
            <p className="mb-1 text-base font-bold">Weapon</p>
            {/* No real weapon equipped falls back to the character's own
                1-star starter weapon, same DEFAULT_WEAPON treatment
                WeaponSlotPicker itself uses for this exact case -- a build
                always has SOME weapon in-game, never a blank slot. */}
            <ul className={`${SLOT_SIZE_CLASS} shrink-0`}>
              <WeaponCard
                name={weapon?.name ?? DEFAULT_WEAPON[character.weaponType].name}
                weaponType={character.weaponType}
                rarity={weapon?.rarity ?? DEFAULT_WEAPON_RARITY}
                secondaryStatName={weapon?.secondaryStatName ?? null}
                iconUrl={weapon?.iconUrl ?? DEFAULT_WEAPON[character.weaponType].iconUrl}
                hoverDetail={weapon?.hoverDetail}
                showWeaponTypeBadge={false}
                showName={false}
                borderClassName={weaponConflict ? "border-2 border-red-500" : "border border-white"}
              />
            </ul>
          </div>

          <div className="col-span-5">
            <p className="mb-1 text-base font-bold">Artifacts</p>
            <div className="grid grid-cols-5 gap-2">
              {SLOTS.map((slot) => {
                const artifact = artifacts.find((a) => a.slot === slot);
                return (
                  <ul key={slot} className={`${SLOT_SIZE_CLASS} shrink-0`}>
                    {artifact ? (
                      <ArtifactCard
                        setName={artifact.setName}
                        slot={slot}
                        rarity={artifact.rarity}
                        mainStatName={artifact.mainStatName}
                        iconUrl={artifact.iconUrl}
                        tooltipContent={buildTooltipContent(artifact)}
                        showSetName={false}
                        showSlotBadge={false}
                        borderClassName={
                          conflictingArtifactIds.includes(artifact.ownedArtifactId)
                            ? "border-2 border-red-500"
                            : "border border-white"
                        }
                      />
                    ) : (
                      // Same dashed/dimmed/cursor-not-allowed treatment
                      // ArtifactSlotPicker's own disabled state uses for a
                      // slot with nothing in it -- keeps the slot icon
                      // visible (just dimmed) so which slot is empty
                      // (flower/feather/sands/goblet/circlet) is still
                      // clear, same reasoning as there.
                      <div
                        title="No artifact equipped"
                        className={`relative flex ${SLOT_SIZE_CLASS} shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-500 bg-foreground/5 opacity-40`}
                      >
                        <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt="" fill className="object-contain p-1" />
                      </div>
                    )}
                  </ul>
                );
              })}
            </div>
          </div>
        </div>

        {/* min-h-0 -- same reasoning as BuildEditor's own wrapper: without
            it, a flex child's default min-height: auto floors this at its
            own content height, ignoring flex-1 whenever that content is
            shorter than the splash art next to it. */}
        <div className="min-h-0 flex-1">
          <BuildStatsSummary character={character} weapon={weapon} artifacts={artifacts} />
        </div>
      </div>
    </div>
  );
}
