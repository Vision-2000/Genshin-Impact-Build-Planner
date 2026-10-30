"use client";

import { useState } from "react";
import Link from "next/link";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { Modal } from "@/components/modal";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { BuildPortrait } from "@/components/build-portrait";
import { CharacterCard } from "../characters/character-card";
import { toOverlapCheckBuild, type BuildOption } from "./filter-sort";

// Sits alongside the real CharacterCard entries in the modal grid so
// clearing a filled slot back to empty is just another option to click,
// not a separate control outside the grid -- same pattern as
// NoneCharacterCard/NoneArtifactCard in the build pickers.
function NoneBuildCard({ onSelect }: { onSelect: () => void }) {
  return (
    <li>
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect();
        }}
        className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-xl border border-white bg-foreground/10 shadow hover:opacity-90"
      >
        <span className="text-lg font-semibold text-gray-400">None</span>
      </div>
    </li>
  );
}

// One of a team's (up to 4) build slots -- same click-a-box/modal-grid
// interaction as WeaponSlotPicker/ArtifactSlotPicker. The filled slot's own
// card uses BuildPortrait (the same character-icon-beside-weapon-and-
// artifact-effects-icons layout BuildCard uses on the Builds page) rather
// than CharacterCard -- a small circular badge was tried first for the
// weapon/set-effect icons and found genuinely too small to read at a
// glance, which is the whole point of showing them here at all. The
// modal's own candidate grid still uses CharacterCard with the combined
// "<character> — <build>" label, since scanning a list of many builds
// across many characters needs that character context up front, and
// doesn't need the full equipped-loadout preview a filled slot does.
// Unlike WeaponSlotPicker/ArtifactSlotPicker, there's no `disabled` state
// here -- a team slot is always choosable (there's no upstream field like
// a character that narrows candidates first), and the team-size cap is
// enforced by only ever rendering 4 of these per team, not by disabling
// one once a count is reached.
export function BuildSlotPicker({
  builds,
  // The OTHER builds already filling this team's remaining slots --
  // passed in (not computed here) since this component has no idea which
  // team it belongs to or what the other slots hold. Used purely to keep
  // a candidate from creating a conflict with them; this slot's OWN
  // current build is deliberately excluded from this list by the caller,
  // so re-opening this picker never treats the current pick as already
  // "taken".
  otherOverlapBuilds,
  value,
  onChange,
  boxSizeClassName = "h-32 w-32",
}: {
  builds: BuildOption[];
  otherOverlapBuilds: OverlapCheckBuild[];
  value: number | null;
  onChange: (buildId: number | null) => void;
  boxSizeClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = value !== null ? builds.find((b) => b.buildId === value) : undefined;

  const query = search.trim().toLowerCase();
  // A candidate can never be the one currently in THIS slot (re-picking
  // yourself is a no-op, so it's left out rather than offered) -- every
  // other owned build is included unless it would create a duplicate-
  // character/exclusivity/shared-weapon/shared-artifact conflict with
  // whatever's already in this team's other slots (see detectOverlaps'
  // own comment -- all four are hard blocks, not advisory warnings, so a
  // conflicting build simply never appears here rather than being
  // selectable then rejected).
  const candidates = builds.filter((build) => {
    if (build.buildId === value) return false;
    if (
      !build.characterName.toLowerCase().includes(query) &&
      !build.name.toLowerCase().includes(query)
    ) {
      return false;
    }
    return detectOverlaps([...otherOverlapBuilds, toOverlapCheckBuild(build)]).length === 0;
  });

  function select(buildId: number | null) {
    onChange(buildId);
    setOpen(false);
  }

  return (
    <>
      {selected ? (
        <div
          onClick={() => setOpen(true)}
          role="button"
          tabIndex={0}
          title={`${selected.characterName} — ${selected.name}`}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setOpen(true);
          }}
          className={`flex ${boxSizeClassName} shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white shadow hover:opacity-90 ${rarityGradientClasses(
            selected.rarity
          )}`}
        >
          <BuildPortrait
            characterIconUrl={selected.characterIconUrl}
            buildName={selected.name}
            characterName={selected.characterName}
            weaponIconUrl={selected.weaponIconUrl}
            weaponRarity={selected.weaponRarity}
            characterWeaponType={selected.weaponType}
            activeSetEffects={selected.activeSetEffects}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Assign a build"
          className={`relative flex ${boxSizeClassName} shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-foreground/10 p-1 hover:opacity-90`}
        >
          <BlinkingPlusIcon />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Choose build" maxWidthClassName="max-w-4xl">
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            placeholder="Search by character or build name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
          />

          <p className="text-sm text-gray-500">
            Need another build? Create one on the{" "}
            <Link href="/builds" className="underline hover:text-foreground">
              Builds page
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto [scrollbar-gutter:stable] sm:grid-cols-4 md:grid-cols-5">
            <NoneBuildCard onSelect={() => select(null)} />
            {candidates.map((build) => (
              <CharacterCard
                key={build.buildId}
                name={`${build.characterName} — ${build.name}`}
                element={build.element}
                weaponType={build.weaponType}
                rarity={build.rarity}
                iconUrl={build.characterIconUrl}
                onSelect={() => select(build.buildId)}
                borderClassName="border border-white"
              />
            ))}
          </ul>
          {candidates.length === 0 && <p className="p-2 text-sm text-gray-500">No builds match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
