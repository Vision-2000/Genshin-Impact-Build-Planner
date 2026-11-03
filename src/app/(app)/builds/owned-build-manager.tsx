"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { BuildPortrait } from "@/components/build-portrait";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls, PaginationNavButtons } from "../pagination-controls";
import { ElementFilterRow } from "../characters/element-filter-row";
import { updateBuildName, updateBuildWeapon, setBuildArtifact, deleteBuild, getBuildContainerNames } from "./actions";
import { ArtifactSlotPicker } from "./artifact-slot-picker";
import { CharacterSlotPicker } from "./character-slot-picker";
import { WeaponSlotPicker } from "./weapon-slot-picker";
import { BuildStatsSummary } from "./build-stats-summary";
import { BuildCatalog, readDraft, DRAFT_KEY } from "./build-catalog";
import {
  filterAndSortBuilds,
  activeSetEffectsFromArtifacts,
  type BuildItem,
  type BuildSortKey,
  type OwnedArtifactOption,
  type OwnedCharacterOption,
  type OwnedWeaponOption,
} from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const PAGE_SIZE = 60;
// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts)
// -- same RARITIES the owned characters page itself filters by, since a
// build's own rarity filter is really its character's.
const RARITIES = [5, 4];
// Compact size for the edit modal's own weapon/artifact slots -- same
// fixed-size reasoning (and same value) as BuildCatalog's own
// SLOT_SIZE_CLASS: both forms sit inside a width-capped Modal, so a fixed
// size that's guaranteed to fit alongside 5 artifact slots at the modal's
// own max width is more robust than anything viewport-relative.
const EDITOR_SLOT_SIZE_CLASS = "h-32 w-32";

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Same per-slot shape as BuildCatalog's own SlotSelections -- a staged pick
// per artifact slot, not yet committed to the server.
type SlotSelections = Partial<Record<ArtifactSlot, number>>;

// What BuildEditor's own Save button hands back -- every field staged
// locally while the modal is open, committed together only on that click
// (see BuildEditor's own top comment on why this replaced per-field
// autosave).
type BuildEditDraft = {
  name: string;
  ownedWeaponId: number | null;
  slots: SlotSelections;
};

// Display-only grid card, same treatment as the other pages: character
// portrait as the hero image, rarity-tinted border. Below it, the weapon
// icon and a flower icon per active artifact set effect. Clicking the card
// opens the edit modal (same click-to-open pattern as WeaponCard/
// ArtifactCard); deleting a build happens from inside that modal
// (BuildEditor's own "Delete build" button), not on the card itself.
function BuildCard({
  build,
  isActive,
  onEdit,
}: {
  build: BuildItem;
  isActive: boolean;
  onEdit: () => void;
}) {
  return (
    <li className="relative">
      {/* flex row, not stacked -- BuildPortrait's own character icon (2x2
          units, w-2/3 aspect-square) sits beside its weapon+artifact
          column (1x1 units each, w-1/3 aspect-square, stacked with no gap
          so their combined height exactly matches the character icon's
          own 2-unit height), making the whole row a 3-wide/2-tall
          rectangle. Replaces the earlier design (full-width 4:3 splash on
          top, a separate weapon+artifact row below it) -- now that the
          artifact side is always a single square regardless of 0/1/2
          active set effects, there's no more reason for that second row
          to exist as a separate block at all. */}
      <div
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onEdit();
        }}
        className={`flex w-full cursor-pointer overflow-hidden rounded-xl border-8 shadow hover:opacity-90 ${
          isActive ? "border-blue-500" : "border-gray-600"
        } ${rarityGradientClasses(build.characterRarity)}`}
      >
        <BuildPortrait
          characterIconUrl={build.characterIconUrl}
          characterElement={build.characterElement}
          buildName={build.name}
          characterName={build.characterName}
          weaponIconUrl={build.weaponIconUrl}
          weaponRarity={build.weaponRarity}
          characterWeaponType={build.characterWeaponType}
          activeSetEffects={build.activeSetEffects}
        />
      </div>
    </li>
  );
}

// Same form BuildCatalog itself uses to CREATE a build (name field,
// CharacterSlotPicker/WeaponSlotPicker/ArtifactSlotPicker, then the shared
// BuildStatsSummary) -- editing reuses it wholesale rather than keeping a
// separate, simpler edit layout, so a build looks and behaves the same way
// whether you're creating or editing one. The one deliberate difference:
// CharacterSlotPicker is `locked` here -- a build's character is fixed at
// creation (see Build's own schema comment), so this is the one field that
// stays read-only. Every other field is staged locally (name/weapon/
// artifacts) and committed together only when Save is pressed -- same
// deferred-until-submit contract as BuildCatalog's own create form, not
// the per-field autosave this replaced. Closing the modal any other way
// (Escape, a backdrop click) discards the local state untouched, so no
// change ever reaches the server unless Save was actually clicked.
function BuildEditor({
  build,
  character,
  weapons,
  artifacts,
  onSave,
  onDelete,
  onClose,
}: {
  build: BuildItem;
  character: OwnedCharacterOption;
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  onSave: (draft: BuildEditDraft) => void;
  onDelete: () => void;
  // Owns its own Modal now (see this component's own top-level return) --
  // same reasoning BuildCatalog's own Modal-ownership comment already
  // gives: OwnedBuildManager only mounts this while editingBuild/
  // editingCharacter are non-null, so there's nothing left for a separate
  // `open` prop to say that mounting it didn't already say. onClose is
  // what lets OwnedBuildManager actually clear that state back to null.
  onClose: () => void;
}) {
  const [name, setName] = useState(build.name);
  const [weaponId, setWeaponId] = useState(build.ownedWeaponId);
  const [slots, setSlots] = useState<SlotSelections>(() => {
    const initial: SlotSelections = {};
    for (const a of build.artifacts) {
      if (a.ownedArtifactId !== null) initial[a.slot] = a.ownedArtifactId;
    }
    return initial;
  });

  const weapon = weaponId !== null ? weapons.find((w) => w.ownedWeaponId === weaponId) : undefined;
  const selectedArtifacts = SLOTS.map((slot) => {
    const ownedArtifactId = slots[slot];
    return ownedArtifactId !== undefined ? artifacts.find((a) => a.ownedArtifactId === ownedArtifactId) : undefined;
  }).filter((a): a is OwnedArtifactOption => a !== undefined);

  // Smaller than Modal's own h-10 close button (h-7, tighter px) -- same
  // sizing as BuildDetailModal's own headerActions buttons
  // (build-detail-modal.tsx), so Delete/Save read as proportional to the
  // plain X beside them instead of oversized.
  const headerButtonClassName = "flex h-7 items-center whitespace-nowrap rounded border px-2 text-xs font-semibold";

  return (
    <Modal
      open
      onClose={onClose}
      maxWidthClassName="max-w-7xl"
      // The editable Name field itself, not a static heading -- this is
      // the one Modal caller in the app whose "title" is actually a form
      // field, since BuildEditor has no other fixed identity to show (the
      // character/build pairing is exactly what's being edited here).
      // font-normal on the input overrides the title row's own
      // font-semibold, which would otherwise bold the typed text too.
      title={
        <label className="flex items-center gap-2">
          <span>Name:</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border bg-white px-2 pb-0.5 pt-1.5 text-sm font-normal text-black"
          />
        </label>
      }
      // Delete alongside Save, both now living next to the close button
      // instead of their own bordered row -- deleting is still immediate
      // (a separately confirmed, already-destructive action, not part of
      // the staged draft), Save is what commits the staged name/weapon/
      // artifacts.
      headerActions={
        <>
          <button
            type="button"
            onClick={onDelete}
            className={`${headerButtonClassName} border-red-600 bg-red-600 text-white hover:bg-red-700`}
          >
            Delete build
          </button>
          <button
            type="button"
            onClick={() => onSave({ name: name.trim() || build.name, ownedWeaponId: weaponId, slots })}
            className={`${headerButtonClassName} border-white bg-black text-white hover:bg-gray-800`}
          >
            Save build
          </button>
        </>
      }
    >
      <div className="flex w-full flex-col sm:flex-row">
        <CharacterSlotPicker characters={[character]} value={character.ownedCharacterId} onChange={() => {}} locked />

        {/* pb-2 (not pb-4) -- matches CharacterSlotPicker's own bottom
            padding exactly, so BuildStatsSummary's own stretched h-full
            bottom edge (which now fills all the way down to this
            padding, see its own comment) lands flush with the splash
            art's bottom instead of stopping 8px short of it. */}
        <div className="flex flex-1 flex-col gap-4 px-4 pb-2 pt-2">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="mb-1 text-base font-bold">Weapon</p>
              <WeaponSlotPicker
                weaponType={character.weaponType}
                weapons={weapons}
                value={weaponId}
                onChange={setWeaponId}
                boxSizeClassName={EDITOR_SLOT_SIZE_CLASS}
                // border border-white (not the usual 8px gray, and not no
                // border) -- thin enough not to read as too thick at this
                // compact size, but still enough to mark where the card
                // ends: its own bottom gradient overlay fades to near-
                // black, which otherwise blends invisibly into the page's
                // own black background.
                cardBorderClassName="border border-white"
              />
            </div>

            <div>
              <p className="mb-1 text-base font-bold">Artifacts</p>
              <div className="flex gap-2">
                {SLOTS.map((slot) => (
                  <ArtifactSlotPicker
                    key={slot}
                    slot={slot}
                    artifacts={artifacts}
                    value={slots[slot] ?? null}
                    onChange={(ownedArtifactId) =>
                      setSlots((prev) => ({ ...prev, [slot]: ownedArtifactId ?? undefined }))
                    }
                    boxSizeClassName={EDITOR_SLOT_SIZE_CLASS}
                    // border border-white -- same thin-border fix as the
                    // Weapon slot above, same reason.
                    cardBorderClassName="border border-white"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* min-h-0 -- without it, a flex child's default min-height:
              auto would floor this at its own content height, ignoring
              flex-1 whenever that content is shorter than the splash art
              next to it (the whole point here -- see BuildStatsSummary's
              own h-full). */}
          <div className="min-h-0 flex-1">
            <BuildStatsSummary character={character} weapon={weapon ?? null} artifacts={selectedArtifacts} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function OwnedBuildManager({
  header,
  characters,
  weapons,
  artifacts,
  initialBuilds,
  initialEditBuildId = null,
}: {
  // The page's own title block -- rendered on the same row as "Create
  // build", same header shape every other page uses (see page.tsx's own
  // comment on why that row lives in here).
  header: ReactNode;
  characters: OwnedCharacterOption[];
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  initialBuilds: BuildItem[];
  // From page.tsx's own ?edit= query param -- set by BuildDetailModal's
  // "Edit build" button on the Teams page, to land here with that
  // build's own BuildEditor already open, same as clicking its card
  // would. null (the default) for every other, ordinary page load.
  initialEditBuildId?: number | null;
}) {
  useRefreshOnBackNavigation();
  const [builds, setBuilds] = useState(initialBuilds);
  // useState(initialBuilds) only ever consults that argument on the very
  // first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialBuilds, setPrevInitialBuilds] = useState(initialBuilds);
  if (initialBuilds !== prevInitialBuilds) {
    setPrevInitialBuilds(initialBuilds);
    setBuilds(initialBuilds);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  // Two separate boxes (see BuildFilters' own comment on why they combine
  // as AND, not one shared box OR-ing build name against character name),
  // same split Teams already established for its own team-name/
  // character-name search.
  const [buildNameSearch, setBuildNameSearch] = useState("");
  const [characterNameSearch, setCharacterNameSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  // "obtained" (not "name") -- matches the owned pages' own default
  // exactly, not just offering the same option (see BuildSortKey's own
  // comment on why build name isn't one of the options at all anymore).
  const [sortKey, setSortKey] = useState<BuildSortKey>("obtained");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(initialEditBuildId);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Reopens the "create build" modal on mount if a draft was left behind
  // by BuildCatalog's own sessionStorage persistence -- e.g. the user
  // followed a picker's own "add it" link to a different page (unmounting
  // this component entirely) and came back via the browser Back button.
  // Starts false (SSR-safe) and flips true in an effect for the same
  // reason BuildCatalog's own draft-restore effect does: sessionStorage
  // only exists on the client.
  useEffect(() => {
    if (readDraft()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreating(true);
    }
  }, []);

  const filtered = filterAndSortBuilds(builds, {
    buildNameSearch,
    characterNameSearch,
    elementFilter,
    weaponTypeFilter,
    rarityFilter,
    sortKey,
    sortDirection,
  });
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);
  const editingBuild = editingId === null ? null : (builds.find((b) => b.id === editingId) ?? null);
  const editingCharacter = editingBuild
    ? (characters.find((c) => c.ownedCharacterId === editingBuild.ownedCharacterId) ?? null)
    : null;
  const activeId = editingId ?? pendingDeleteId;

  // Commits BuildEditor's own staged draft all at once, only once Save is
  // actually clicked -- compares each field against the build's own
  // current (server-persisted) value and only calls the matching action
  // for whatever genuinely changed, rather than unconditionally re-writing
  // all three every time. Optimistically applies the full new state (incl.
  // a client-side activeSetEffects recompute, see
  // activeSetEffectsFromArtifacts) immediately, then rolls the whole thing
  // back if any one of the server calls fails.
  function handleSaveEdit(build: BuildItem, draft: BuildEditDraft) {
    const previous = builds;

    const weapon =
      draft.ownedWeaponId !== null ? weapons.find((w) => w.ownedWeaponId === draft.ownedWeaponId) : undefined;
    const nextArtifacts = SLOTS.map((slot) => {
      const ownedArtifactId = draft.slots[slot] ?? null;
      const option = ownedArtifactId !== null ? artifacts.find((a) => a.ownedArtifactId === ownedArtifactId) : undefined;
      return {
        slot,
        ownedArtifactId,
        setName: option?.setName ?? null,
        mainStatName: option?.mainStatName ?? null,
        iconUrl: option?.iconUrl ?? null,
      };
    });
    const nextSelectedArtifacts = nextArtifacts
      .map((a) => (a.ownedArtifactId !== null ? artifacts.find((o) => o.ownedArtifactId === a.ownedArtifactId) : undefined))
      .filter((a): a is OwnedArtifactOption => a !== undefined);

    setBuilds((prev) =>
      prev.map((b) =>
        b.id === build.id
          ? {
              ...b,
              name: draft.name,
              ownedWeaponId: draft.ownedWeaponId,
              weaponName: weapon?.name ?? null,
              weaponIconUrl: weapon?.iconUrl ?? null,
              weaponRefinement: weapon?.refinement ?? null,
              weaponRarity: weapon?.rarity ?? null,
              artifacts: nextArtifacts,
              activeSetEffects: activeSetEffectsFromArtifacts(nextSelectedArtifacts),
            }
          : b
      )
    );
    setEditingId(null);

    startTransition(async () => {
      try {
        if (draft.name !== build.name) await updateBuildName(build.id, draft.name);
        if (draft.ownedWeaponId !== build.ownedWeaponId) await updateBuildWeapon(build.id, draft.ownedWeaponId);
        for (const slot of SLOTS) {
          const nextId = draft.slots[slot] ?? null;
          const currentId = build.artifacts.find((a) => a.slot === slot)?.ownedArtifactId ?? null;
          if (nextId !== currentId) await setBuildArtifact(build.id, slot, nextId);
        }
      } catch {
        setBuilds(previous);
      }
    });
  }

  async function handleDelete(buildId: number) {
    setPendingDeleteId(buildId);
    const { teamNames, rosterNames } = await getBuildContainerNames(buildId);
    const containerLabels = [
      ...teamNames.map((name) => `team "${name}"`),
      ...rosterNames.map((name) => `roster "${name}"`),
    ];
    const message =
      containerLabels.length > 0
        ? `This build is used in: ${containerLabels.join(", ")}. Deleting it will remove it from ${
            containerLabels.length === 1 ? "that" : "those"
          } too. Delete anyway?`
        : "Delete this build? This can't be undone.";

    const confirmed = await confirm(message, { title: "Delete build", confirmLabel: "Delete", danger: true });
    setPendingDeleteId(null);
    if (!confirmed) return;

    setEditingId((current) => (current === buildId ? null : current));
    startTransition(() => {
      const previous = builds;
      setBuilds((prev) => prev.filter((b) => b.id !== buildId));
      deleteBuild(buildId).catch(() => setBuilds(previous));
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {header}

        {/* pt-3/pb-2 (not py-2.5) -- same Arial line-height fix as every
            other text-centered control in this app, see
            build-stats-summary.tsx's own comment on the root cause. */}
        <button
          type="button"
          onClick={() => {
            // A deliberate click here is a fresh session, not a
            // continuation of whatever draft the mount effect above might
            // otherwise restore -- clear it first so BuildCatalog starts
            // blank. Returning to a leftover draft (e.g. after following a
            // picker's own "add it" link and coming back) goes through
            // that mount effect instead, never through this click handler.
            try {
              sessionStorage.removeItem(DRAFT_KEY);
            } catch {
              // Ignore -- worst case the draft (if any) gets restored anyway.
            }
            setCreating(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border px-4 pb-2 pt-3 text-sm font-semibold hover:bg-black/5"
        >
          {/* The "+" and this text are flex siblings (items-center) at
              different font sizes/line-heights (text-base leading-none
              vs this text's own default text-sm), so items-center
              centers each independently -- the button's own pt-3/pb-2
              above shifts the whole row, not their position relative to
              each other. mt-0.5 nudges the text down and -mt-0.5 nudges
              the "+" up by the same amount to meet it, same small-nudge
              pattern used throughout this app for a badge/icon sitting
              next to plain text. */}
          <span className="-mt-0.5 text-base leading-none">+</span>
          <span className="mt-0.5">Create build</span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by build name..."
            value={buildNameSearch}
            onChange={(event) => {
              setBuildNameSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
          />
          <input
            type="text"
            placeholder="Search by character name..."
            value={characterNameSearch}
            onChange={(event) => {
              setCharacterNameSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
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

        {/* Same character-page filters (element/weapon type/rarity), just
            matched against each build's own character -- see
            filterAndSortBuilds's own comment. */}
        <ElementFilterRow
          elementFilter={elementFilter}
          onToggle={(element) => {
            setElementFilter((prev) => toggleInSet(prev, element));
            setPage(1);
          }}
        />
        <WeaponTypeFilterRow
          weaponTypeFilter={weaponTypeFilter}
          onToggle={(weaponType) => {
            setWeaponTypeFilter((prev) => toggleInSet(prev, weaponType));
            setPage(1);
          }}
        />
        <RarityFilterRow
          rarities={RARITIES}
          rarityFilter={rarityFilter}
          onToggle={(rarity) => {
            setRarityFilter((prev) => toggleInSet(prev, rarity));
            setPage(1);
          }}
        />

        {/* min-h-8 -- PaginationNavButtons renders nothing below a 2nd
            page; without a reserved height, crossing into one grows this
            row (its own buttons are taller than the count text alone)
            and visibly shifts the grid below it down. Same fix as the
            Teams page's own top row. */}
        <div className="flex min-h-8 items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {filtered.length} build{filtered.length === 1 ? "" : "s"}
          </p>
          <PaginationNavButtons currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>

        {/* The empty-state message replaces the <ul> rather than sitting
            inside it -- a <ul> may only directly contain <li>, and a <p>
            there reads to screen readers as a one-item list. */}
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-500">No builds match these filters.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((build) => (
              <BuildCard
                key={build.id}
                build={build}
                isActive={build.id === activeId}
                onEdit={() => setEditingId(build.id)}
              />
            ))}
          </ul>
        )}

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />

        {/* BuildEditor owns its own Modal now (see its own top-level
            return) -- mounting it here only while both are non-null is
            what controls "open", the same pattern BuildCatalog's own
            conditional mount below already uses. */}
        {editingBuild && editingCharacter && (
          <BuildEditor
            key={editingBuild.id}
            build={editingBuild}
            character={editingCharacter}
            weapons={weapons}
            artifacts={artifacts}
            onSave={(draft) => handleSaveEdit(editingBuild, draft)}
            onDelete={() => handleDelete(editingBuild.id)}
            onClose={() => setEditingId(null)}
          />
        )}

        {creating && (
          <BuildCatalog
            characters={characters}
            weapons={weapons}
            artifacts={artifacts}
            onCreated={(build) => setBuilds((prev) => [...prev, build])}
            onClose={() => setCreating(false)}
          />
        )}
      </div>
    </div>
  );
}
