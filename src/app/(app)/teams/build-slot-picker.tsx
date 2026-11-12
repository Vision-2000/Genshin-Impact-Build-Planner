"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { detectOverlaps, type OverlapCheckBuild } from "@/lib/overlap";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import type { SortDirection } from "@/lib/sort";
import { Modal } from "@/components/modal";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { BuildPortrait } from "@/components/build-portrait";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { ElementFilterRow } from "../characters/element-filter-row";
import { BuildDetailModal } from "../builds/build-detail-modal";
import type { BuildSortKey } from "../builds/filter-sort";
import { toOverlapCheckBuild, filterAndSortBuildOptions, type BuildOption } from "./filter-sort";

// Same tiny toggle-in-set helper every other filter-row caller in this app
// keeps its own local copy of (weapon-slot-picker.tsx, artifact-slot-
// picker.tsx, owned-build-manager.tsx, ...) rather than importing one
// shared version -- small enough that duplicating it reads clearer than a
// cross-file dependency for 5 lines.
function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Same RARITIES the Builds/Characters pages themselves filter by --
// playable characters are only ever seeded at 4-5 star, and a build's own
// rarity filter is really its character's.
const RARITIES = [5, 4];

// Sits alongside the real build-portrait cards in the modal grid so
// clearing a filled slot back to empty is just another option to click,
// not a separate control outside the grid -- same pattern as
// NoneCharacterCard/NoneArtifactCard in the build pickers. aspect-[3/2]
// (not aspect-square) to match BuildOptionCard's own shape below, now
// that the grid is all rectangular cards instead of square ones.
function NoneBuildCard({ onSelect, selected = false }: { onSelect: () => void; selected?: boolean }) {
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
        // Blue, same width, when this slot is currently empty (value ===
        // null) -- same "mark the currently selected option" treatment
        // WeaponSlotPicker/ArtifactSlotPicker's own grids now use.
        className={`flex aspect-[3/2] w-full cursor-pointer items-center justify-center rounded-xl border bg-foreground/10 shadow hover:opacity-90 ${
          selected ? "border-blue-500" : "border-white"
        }`}
      >
        <span className="text-lg font-semibold text-gray-400">None</span>
      </div>
    </li>
  );
}

// A candidate in the modal's own grid -- same BuildPortrait content (and
// rarity-gradient background) as a team slot's own filled display below,
// so a build's equipped weapon/artifact-set-effects are visible at a
// glance while browsing, not just after picking it. Replaced an earlier
// design that used CharacterCard with a "<character> — <build>" label
// instead (character context alone, no loadout preview) -- found
// inconvenient once a team already has several similar builds and the
// user can't tell which is which without opening each one first.
function BuildOptionCard({
  build,
  selected,
  weaponConflict,
  artifactConflict,
  onSelect,
  onView,
}: {
  build: BuildOption;
  selected: boolean;
  // Whether picking this candidate would share a weapon/artifact with a
  // build already in one of this team's OTHER slots -- same red ring-
  // inset/border BuildPortrait already draws on a team slot's own filled
  // display for exactly this signal (see its own weaponConflict/
  // artifactConflict props), reused here as-is. Unlike that card, a
  // flagged candidate here can still be VIEWED (so the user can see
  // exactly what collides and go edit a fix) but can't be SELECTED --
  // these builds were previously excluded from the grid outright; showing
  // them instead (with selection blocked) lets the user see where things
  // went wrong rather than wondering why a build they know they own isn't
  // listed. Duplicate-character/exclusivityGroup conflicts are NOT
  // included here and still exclude a candidate entirely (see this
  // component's own caller) -- there's no sensible tile to highlight for
  // "wrong character", and no edit fixes it either.
  weaponConflict: boolean;
  artifactConflict: boolean;
  onSelect: () => void;
  // Same bottom-strip "View" zone (hover-revealed, stops both pointerdown
  // and click from bubbling) as a team slot's own filled display -- opens
  // THIS picker's own BuildDetailModal (see the bottom of this file),
  // not the Teams page's shared one, since a candidate here was never
  // added to the team at all.
  onView: (buildId: number) => void;
}) {
  const conflicting = weaponConflict || artifactConflict;

  return (
    <li>
      <div
        onClick={conflicting ? undefined : onSelect}
        role="button"
        aria-disabled={conflicting}
        tabIndex={conflicting ? undefined : 0}
        title={
          conflicting
            ? `${build.characterName} — ${build.name} (shares a weapon/artifact with another slot -- view for details)`
            : `${build.characterName} — ${build.name}`
        }
        onKeyDown={
          conflicting
            ? undefined
            : (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect();
              }
        }
        // group/has-[.view-zone:hover]:opacity-100! -- same reasoning as
        // the filled slot's own identical card below: without it, hovering
        // the View button itself would ALSO trigger this card's own
        // hover:opacity-90, showing both hover states disagreeing at once.
        // conflicting drops cursor-pointer/hover:opacity-90 in favor of
        // cursor-not-allowed -- the card itself is inert (View is still
        // reachable via its own always-active button). border-red-500
        // (same default border WIDTH as the selected/plain cases, just a
        // different color, same as the Teams page's own whole-team-card
        // conflict border) takes priority over "selected" -- the whole
        // card is flagged, not just the weapon/artifact tile BuildPortrait
        // itself already highlights below.
        className={`group relative flex w-full overflow-hidden rounded-lg border shadow has-[.view-zone:hover]:opacity-100! ${
          conflicting ? "cursor-not-allowed" : "cursor-pointer hover:opacity-90"
        } ${conflicting ? "border-red-500" : selected ? "border-blue-500" : "border-white"} ${rarityGradientClasses(build.rarity)}`}
      >
        <BuildPortrait
          characterIconUrl={build.characterIconUrl}
          characterElement={build.element}
          buildName={build.name}
          characterName={build.characterName}
          weaponIconUrl={build.weaponIconUrl}
          weaponRarity={build.weaponRarity}
          characterWeaponType={build.weaponType}
          activeSetEffects={build.activeSetEffects}
          // These cards render smaller than a team slot's own filled
          // display -- the build name alone (still enough to tell
          // same-character builds apart, with the character icon itself
          // still visible) avoids a cramped/truncated second line here.
          showCharacterName={false}
          weaponConflict={weaponConflict}
          artifactConflict={artifactConflict}
        />

        <button
          type="button"
          title="View build details"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onView(build.buildId);
          }}
          className="view-zone absolute inset-x-0 bottom-0 flex h-[20%] items-center justify-center bg-black/60 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
        >
          View
        </button>
      </div>
    </li>
  );
}

// One of a team's (up to 4) build slots -- same click-a-box/modal-grid
// interaction as WeaponSlotPicker/ArtifactSlotPicker. The filled slot's own
// card uses BuildPortrait (the same character-icon-beside-weapon-and-
// artifact-effects-icons layout BuildCard uses on the Builds page), and so
// does the modal's own candidate grid now (BuildOptionCard above) -- a
// small circular badge was tried first for the weapon/set-effect icons and
// found genuinely too small to read at a glance, which is the whole point
// of showing them here at all.
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
  // Opens a read-only "view build details" popover elsewhere (the Teams
  // page's own BuildDetailModal) instead of this slot's own swap modal --
  // optional since the empty-slot state has nothing to view. Scoped to a
  // fixed bottom strip of the card (see the "View" zone below), not a
  // hover reveal: the whole rest of the card keeps its existing click-to-
  // swap/drag-to-reorder behavior untouched.
  onView,
  // Whether THIS slot's own build (if any) is currently involved in one
  // of its team's computeTeamConflicts (team-manager.tsx) -- a red
  // ring-inset on BuildPortrait's own weapon/artifact-effects tile, see
  // its own comment. Both default to false, same as BuildPortrait's own
  // defaults, for every caller that doesn't track conflicts at all.
  weaponConflict = false,
  artifactConflict = false,
  // Lets an external trigger -- BuildDetailModal's own "Select another
  // build" button (team-manager.tsx), reached from a totally different
  // part of the tree than this specific slot -- reopen THIS slot's swap
  // modal, the same way a user clicking the upper part of its own card
  // would. Same autoOpen/onOpenChange contract WeaponSlotPicker/
  // ArtifactSlotPicker/CharacterSlotPicker already use for their own
  // "reopen after an external event" needs -- onOpenChange fires on every
  // open/close (not just the auto-triggered one), so the caller can clear
  // its own one-shot autoOpen flag once it's been consumed.
  autoOpen,
  onOpenChange,
  boxSizeClassName = "h-32 w-32",
}: {
  builds: BuildOption[];
  otherOverlapBuilds: OverlapCheckBuild[];
  value: number | null;
  onChange: (buildId: number | null) => void;
  onView?: (buildId: number) => void;
  weaponConflict?: boolean;
  artifactConflict?: boolean;
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  boxSizeClassName?: string;
}) {
  const [open, setOpenState] = useState(false);
  // Same search/filter/sort options the Builds page itself offers
  // (owned-build-manager.tsx), imported here via filterAndSortBuildOptions
  // (filter-sort.ts) so picking from a long owned-builds list works the
  // same way in both places -- same two-box AND search, same element/
  // weapon-type/rarity filters, same "obtained"/"character" sort with a
  // direction toggle. Own local state, not shared with the Builds page's
  // own: each slot's picker is independent, and there's no reason a
  // filter set on one team's slot should carry over to another's.
  const [buildNameSearch, setBuildNameSearch] = useState("");
  const [characterNameSearch, setCharacterNameSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  // "obtained" (not "character") -- matches the Builds page's own default
  // exactly, not just offering the same options.
  const [sortKey, setSortKey] = useState<BuildSortKey>("obtained");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // Which candidate's own "View build details" popover is open -- a
  // SEPARATE BuildDetailModal from the Teams page's shared one
  // (team-manager.tsx), since a candidate here was never added to a team
  // at all, so there's no team/slot context for that one to show
  // conflicts against (and nothing stops a user from viewing a candidate
  // while this picker's own "Choose build" modal stays open behind it --
  // both Modals share the same z-40, stacking in mount order). Carries
  // this candidate's own weaponConflict/conflictingArtifactIds alongside
  // its id (computed once, in the grid below, from the SAME per-candidate
  // conflict check `candidates` itself already did) so the popover can
  // highlight the exact colliding weapon/artifact tile, not just open
  // plain.
  const [viewingCandidate, setViewingCandidate] = useState<{
    buildId: number;
    weaponConflict: boolean;
    conflictingArtifactIds: number[];
  } | null>(null);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  // Fires when a caller flips autoOpen to true after this component has
  // already mounted closed (e.g. BuildDetailModal's own "Select another
  // build" button, clicked well after this slot first rendered). Same
  // deliberate react-hooks/set-state-in-effect exception WeaponSlotPicker's
  // own identical effect takes -- this IS "synchronize with a value owned
  // by an external system" (the caller's own one-shot request), not
  // derived-state busywork.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const selected = value !== null ? builds.find((b) => b.buildId === value) : undefined;

  // Search/filter/sort first (filterAndSortBuildOptions -- the imported
  // Builds-page behavior), THEN exclude whatever would create a conflict
  // with this team's other slots -- the two are independent concerns, so
  // order between them doesn't change the result, but computing it this
  // way keeps the "exclude a conflicting build" logic exactly as it was
  // rather than tangling it into the new filter step.
  //
  // THIS slot's own current build is no longer excluded (re-picking it is
  // a harmless no-op, same as WeaponSlotPicker/ArtifactSlotPicker already
  // allow for their own current selection) -- keeping it in the grid is
  // what lets it be blue-bordered below, so it's visible which option is
  // already selected without having to close the modal first.
  //
  // Every other owned build is still checked against detectOverlaps (all
  // four of its conflict types are hard blocks -- see its own comment),
  // but only duplicate-character/exclusivityGroup conflicts still exclude
  // a candidate outright now: there's no sensible tile to highlight for
  // "wrong character for this slot", and no edit to a build's own weapon/
  // artifacts would ever fix it either. A shared-weapon/shared-artifact
  // conflict instead STAYS in the grid, flagged via weaponConflict/
  // artifactConflict (BuildOptionCard's own props, same red highlight
  // BuildPortrait already draws on a team slot's filled display) with
  // selecting it blocked -- showing the user exactly which owned build
  // collides, rather than silently omitting it, so they can go edit a
  // non-colliding version instead of wondering where it went.
  //
  // Only conflicts the CANDIDATE itself would be part of count -- not just
  // "is detectOverlaps' result non-empty at all" over the whole set, which
  // would also reject every candidate whenever two of the OTHER slots
  // already conflict with each other (possible since a build's weapon/
  // artifacts can change after it's already in a team -- see
  // computeTeamConflicts in filter-sort.ts). That pre-existing conflict is
  // real and flagged elsewhere on the team card, but it has nothing to do
  // with whether THIS candidate is safe to add.
  const filtered = filterAndSortBuildOptions(builds, {
    buildNameSearch,
    characterNameSearch,
    elementFilter,
    weaponTypeFilter,
    rarityFilter,
    sortKey,
    sortDirection,
  });
  const candidates = filtered.flatMap((build) => {
    const ownConflicts = detectOverlaps([...otherOverlapBuilds, toOverlapCheckBuild(build)]).filter((conflict) =>
      conflict.buildIds.includes(build.buildId)
    );
    const hasHardConflict = ownConflicts.some(
      (conflict) => conflict.type === "duplicate-character" || conflict.type === "exclusivity-conflict"
    );
    if (hasHardConflict) return [];
    // conflictingArtifactIds (the actual ids, not just a boolean) -- so
    // the candidate's own "View build details" popover (below) can
    // highlight the EXACT colliding artifact slot(s), same as the Teams
    // page's own BuildDetailModal already does for an already-added
    // build's View button (team-manager.tsx's own buildConflictFlags).
    return [
      {
        build,
        weaponConflict: ownConflicts.some((conflict) => conflict.type === "shared-weapon"),
        conflictingArtifactIds: ownConflicts
          .filter((conflict) => conflict.type === "shared-artifact")
          .map((conflict) => conflict.ownedArtifactId),
      },
    ];
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
          // has-[.view-zone:hover]:opacity-100! -- overrides the card's own
          // hover:opacity-90 specifically while the View button itself is
          // being hovered, so the card doesn't ALSO look "hovered" at the
          // same time as the button shows its own separate hover feedback
          // (bg-black/80 below). The ! forces this to win regardless of
          // which of the two same-specificity hover/has- rules Tailwind
          // happens to emit later in its generated stylesheet.
          className={`group relative flex ${boxSizeClassName} shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white shadow hover:opacity-90 has-[.view-zone:hover]:opacity-100! ${rarityGradientClasses(
            selected.rarity
          )}`}
        >
          <BuildPortrait
            characterIconUrl={selected.characterIconUrl}
            characterElement={selected.element}
            buildName={selected.name}
            characterName={selected.characterName}
            weaponIconUrl={selected.weaponIconUrl}
            weaponRarity={selected.weaponRarity}
            characterWeaponType={selected.weaponType}
            activeSetEffects={selected.activeSetEffects}
            weaponConflict={weaponConflict}
            artifactConflict={artifactConflict}
          />

          {onView && (
            // Bottom 15% of the card, full width -- a fixed zone (always
            // there, not revealed on hover itself), but kept invisible
            // (opacity-0) until the CARD is hovered (group-hover, via the
            // `group` class on the outer card above). Stops BOTH
            // pointerdown and click from bubbling: pointerdown so the
            // ancestor slot wrapper's own drag-start handler (team-
            // manager.tsx) never sees this gesture begin at all (so a
            // click or drag here can never start a reorder), and click so
            // it doesn't also trigger this card's own onClick above
            // (which would open the swap modal at the same time).
            // Everywhere else on the card keeps its existing click-to-
            // swap/drag-to-reorder behavior untouched.
            <button
              type="button"
              title="View build details"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onView(selected.buildId);
              }}
              className="view-zone absolute inset-x-0 bottom-0 flex h-[20%] items-center justify-center bg-black/60 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
            >
              View
            </button>
          )}
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

      {/* max-w-6xl (not WeaponSlotPicker/ArtifactSlotPicker's own
          max-w-4xl) -- BuildOptionCard's own cards are rectangular
          (aspect-[3/2], like a team slot's own filled display), wider
          than those pickers' square ones, so the grid needs a bit more
          room to still fit a reasonable number of columns. max-w-5xl
          (tried first) left the 3rd column's own cards butted right up
          against the grid's own scrollbar gutter, overlapping it. */}
      <Modal open={open} onClose={() => setOpen(false)} title="Choose build" maxWidthClassName="max-w-6xl">
        {/* flex-col, not space-y-3 -- a vh-based max-height on the grid
            alone (tried first) still let this modal's TOTAL content
            (search/filter rows + grid) exceed Modal's own max-h-[90vh]
            cap on shorter screens, since those rows have their own real,
            non-negotiable pixel height on top of whatever the grid takes.
            max-h-[calc(90vh-6rem)] here is Modal's own cap minus its own
            fixed chrome -- p-5's 40px top+bottom, the title row's ~40px,
            and the panel's own 2px border (all border-box-included in
            that max-h-[90vh]) -- the budget actually available to THIS
            div. 6rem (96px, not the 80px/5rem tried first, which missed
            the border and left just enough overflow to barely scroll on
            its own) leaves a little slack for that plus any sub-pixel/
            line-height rounding. Every row but the grid is shrink-0 (keep
            its natural height); the grid is flex-1 min-h-0 overflow-y-
            auto, so it's the one thing that absorbs whatever space is
            left AND the one thing that scrolls -- this div itself never
            needs to, so Modal's own outer scroll never triggers either. */}
        <div className="flex max-h-[calc(90vh-6rem)] flex-col gap-3">
          {/* Same search/filter/sort row shapes as the Builds page itself
              (owned-build-manager.tsx) -- see filterAndSortBuildOptions'
              own comment on why this mirrors that page's options exactly
              rather than offering some smaller subset. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Search by build name..."
              value={buildNameSearch}
              onChange={(event) => setBuildNameSearch(event.target.value)}
              className="rounded border bg-white px-3 py-2 text-sm text-black"
            />
            <input
              type="text"
              placeholder="Search by character name..."
              value={characterNameSearch}
              onChange={(event) => setCharacterNameSearch(event.target.value)}
              className="rounded border bg-white px-3 py-2 text-sm text-black"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as BuildSortKey)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="obtained">Sort: Added</option>
              <option value="character">Sort: Character</option>
            </select>
            <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
          </div>

          {/* shrink-0 wrappers -- none of these filter-row components take
              a className of their own to shrink-0 directly, and without
              it a flex-col parent's default flex-shrink:1 could squeeze
              these fixed-content rows below their natural height once
              the column's own total content is taller than its bound
              (see the wrapping div's own comment). */}
          <div className="shrink-0">
            <ElementFilterRow
              elementFilter={elementFilter}
              onToggle={(element) => setElementFilter((prev) => toggleInSet(prev, element))}
            />
          </div>
          <div className="shrink-0">
            <WeaponTypeFilterRow
              weaponTypeFilter={weaponTypeFilter}
              onToggle={(weaponType) => setWeaponTypeFilter((prev) => toggleInSet(prev, weaponType))}
            />
          </div>
          <div className="shrink-0">
            <RarityFilterRow
              rarities={RARITIES}
              rarityFilter={rarityFilter}
              onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
            />
          </div>

          <p className="shrink-0 text-sm text-gray-500">
            Need another build? Create one on the{" "}
            <Link href="/builds" className="underline hover:text-foreground">
              Builds page
            </Link>
            .
          </p>

          {/* grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 -- far fewer columns
              than the square-card pickers' own grid-cols-3..5, since each
              card is now a wide rectangle rather than a small square. */}
          {/* pr-2 -- [scrollbar-gutter:stable] alone only reserves the
              scrollbar's own track width, flush against this grid's last
              column; these cards are wide enough (rectangular, 3 columns
              max vs the square-card pickers' 4-5) that the gutter read as
              no breathing room at all, not a real gap. flex-1 min-h-0 (not
              a fixed max-height of its own) -- see the wrapping div's own
              comment on why this grid absorbs whatever space the
              surrounding flex column has left, rather than guessing at a
              fixed/vh height that could still overflow the modal's own
              cap once combined with the search/filter rows above it. */}
          <ul className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-2 [scrollbar-gutter:stable] sm:grid-cols-2 lg:grid-cols-3">
            <NoneBuildCard onSelect={() => select(null)} selected={value === null} />
            {candidates.map(({ build, weaponConflict, conflictingArtifactIds }) => (
              <BuildOptionCard
                key={build.buildId}
                build={build}
                selected={build.buildId === value}
                weaponConflict={weaponConflict}
                artifactConflict={conflictingArtifactIds.length > 0}
                onSelect={() => select(build.buildId)}
                onView={() => setViewingCandidate({ buildId: build.buildId, weaponConflict, conflictingArtifactIds })}
              />
            ))}
          </ul>
          {candidates.length === 0 && <p className="shrink-0 p-2 text-sm text-gray-500">No builds match this search.</p>}
        </div>
      </Modal>

      {/* A candidate's own "View build details" popover -- see
          viewingCandidate's own comment above on why this is a separate
          BuildDetailModal from the Teams page's shared one. "Select
          build" has the exact same effect as clicking the candidate's
          card directly in the grid above (select() already closes THIS
          picker's own modal too), closing this popover on top of it --
          omitted entirely (not just a no-op) for a conflicting candidate,
          same as the card itself already blocks selecting one directly. */}
      <BuildDetailModal
        buildId={viewingCandidate?.buildId ?? null}
        weaponConflict={viewingCandidate?.weaponConflict ?? false}
        conflictingArtifactIds={viewingCandidate?.conflictingArtifactIds ?? []}
        selectAction={
          viewingCandidate !== null && !viewingCandidate.weaponConflict && viewingCandidate.conflictingArtifactIds.length === 0
            ? {
                label: "Select build",
                onClick: () => {
                  select(viewingCandidate.buildId);
                  setViewingCandidate(null);
                },
              }
            : undefined
        }
        onClose={() => setViewingCandidate(null)}
      />
    </>
  );
}
