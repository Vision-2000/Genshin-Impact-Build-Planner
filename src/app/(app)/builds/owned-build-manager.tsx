"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { BuildPortrait } from "@/components/build-portrait";
import { PlusIcon } from "@/components/plus-icon";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls, PaginationNavButtons } from "../pagination-controls";
import { ElementFilterRow } from "../characters/element-filter-row";
import {
  updateBuildName,
  updateBuildWeapon,
  setBuildArtifact,
  deleteBuild,
  getBuildContainerNames,
  createCollection,
  updateCollection,
  deleteCollection,
} from "./actions";
import { ArtifactSlotPicker } from "./artifact-slot-picker";
import { CharacterSlotPicker } from "./character-slot-picker";
import { WeaponSlotPicker } from "./weapon-slot-picker";
import { BuildStatsSummary } from "./build-stats-summary";
import { BuildCatalog, readDraft, DRAFT_KEY } from "./build-catalog";
import {
  filterAndSortBuilds,
  filterBuilds,
  activeSetEffectsFromArtifacts,
  availableCollectionBuilds,
  computeCollectionConflicts,
  buildCollectionConflictFlags,
  describeCollectionConflict,
  type BuildItem,
  type BuildSortKey,
  type OwnedArtifactOption,
  type OwnedCharacterOption,
  type OwnedWeaponOption,
  type CollectionItem,
} from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const PAGE_SIZE = 60;
// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts)
// -- same RARITIES the owned characters page itself filters by, since a
// build's own rarity filter is really its character's.
const RARITIES = [5, 4];
// Compact size for the edit modal's own weapon/artifact slots -- same
// reasoning (and same value) as BuildCatalog's own SLOT_SIZE_CLASS: an
// aspect-square box filling its own grid-cols-6 column, so all 6 boxes
// shrink together with the Modal's own width instead of the Artifacts
// group wrapping below Weapon once a fixed-width row stopped fitting.
const EDITOR_SLOT_SIZE_CLASS = "aspect-square w-full";

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

// How long (ms) a press has to be held on a card while in collection mode
// before it's treated as "edit this build instead of toggling it" -- see
// BuildCard's own long-press handling below.
const LONG_PRESS_DURATION_MS = 600;
// The ring stays invisible for this long after a press starts, before it
// begins filling over the remaining LONG_PRESS_DURATION_MS - this delay --
// an ordinary quick click/tap is well under this, so it never flashes the
// ring at all. Without it, pressProgress ticks up from 0 on the very first
// animation frame, so even a plain click briefly rendered the ring for one
// frame -- which read as a jarring flicker rather than "nothing happened".
const RING_APPEAR_DELAY_MS = 150;

// A small ring overlay tracking an in-progress long press, 0 (just
// started) to 1 (about to fire) -- the user's own requested "short
// circular progress bar to indicate time required", rather than a plain
// spinner that gives no sense of how much longer to hold. -rotate-90 on
// the <svg> is what makes the stroke sweep clockwise from the top (SVG's
// own 0deg is 3 o'clock otherwise); strokeDashoffset is driven straight
// from `progress`, no animation library needed since the parent already
// re-renders every animation frame while a press is active.
function PressProgressRing({ progress }: { progress: number }) {
  const size = 40;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
    </div>
  );
}

// Display-only grid card, same treatment as the other pages: character
// portrait as the hero image, rarity-tinted border. Below it, the weapon
// icon and a flower icon per active artifact set effect. Clicking the card
// opens the edit modal (same click-to-open pattern as WeaponCard/
// ArtifactCard); deleting a build happens from inside that modal
// (BuildEditor's own "Delete build" button), not on the card itself.
//
// Outside collection mode, a plain click always opens the edit modal --
// BuildCard has just the one click target (unlike TeamCard's rename
// field/4 slots/buttons), so there's no stopPropagation dance needed the
// way TeamCard's own groupSelection needs. In collection mode
// (collectionSelection non-null), a plain click instead toggles this
// build into/out of the in-progress draft -- the user's own explicit
// call that showing a picked build's own OTHER same-character builds as
// still-clickable "just adds unnecessary info" is handled one level up,
// in availableCollectionBuilds (filter-sort.ts), which removes them from
// the list passed down here entirely; this component only ever sees
// builds that are actually still pickable (plus whichever one it's
// currently rendering, if already selected). A long press (held past
// LONG_PRESS_DURATION_MS) is the one way left to still edit a build
// without leaving collection mode, per the user's own request -- a
// pointerup/leave/cancel before that threshold cancels back to a normal
// click instead.
function BuildCard({
  build,
  isActive,
  onEdit,
  collectionSelection,
  weaponConflict = false,
  artifactConflict = false,
}: {
  build: BuildItem;
  isActive: boolean;
  onEdit: () => void;
  collectionSelection?: { selected: boolean; onToggle: () => void };
  weaponConflict?: boolean;
  artifactConflict?: boolean;
}) {
  const [pressProgress, setPressProgress] = useState(0);
  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // Set the instant the long press actually fires onEdit, so the click
  // event the browser still dispatches right after pointerup can be
  // swallowed instead of ALSO toggling selection -- cleared the next time
  // a press starts.
  const longPressFiredRef = useRef(false);

  function cancelPress() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    pressStartRef.current = null;
    setPressProgress(0);
  }

  function tick() {
    const start = pressStartRef.current;
    if (start === null) return;
    const elapsed = performance.now() - start;
    if (elapsed >= LONG_PRESS_DURATION_MS) {
      longPressFiredRef.current = true;
      cancelPress();
      onEdit();
      return;
    }
    // Stays at 0 (ring hidden, see pressProgress' own render check below)
    // until RING_APPEAR_DELAY_MS has passed, then fills over whatever
    // duration remains -- the total time-to-fire is still
    // LONG_PRESS_DURATION_MS either way, only the ring's own visibility is
    // delayed.
    const visibleDuration = LONG_PRESS_DURATION_MS - RING_APPEAR_DELAY_MS;
    setPressProgress(Math.max(0, elapsed - RING_APPEAR_DELAY_MS) / visibleDuration);
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePointerDown(event: ReactPointerEvent) {
    if (!collectionSelection || event.button !== 0) return;
    longPressFiredRef.current = false;
    pressStartRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleClick() {
    if (longPressFiredRef.current) {
      // The long press already opened the editor -- this is just the
      // browser's own trailing click from the same gesture, not a new,
      // separate click meant to toggle selection.
      longPressFiredRef.current = false;
      return;
    }
    if (collectionSelection) collectionSelection.onToggle();
    else onEdit();
  }

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
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (collectionSelection) collectionSelection.onToggle();
          else onEdit();
        }}
        className={`flex w-full cursor-pointer touch-none select-none overflow-hidden rounded-xl border-8 shadow hover:opacity-90 ${
          isActive ? "border-blue-500" : collectionSelection?.selected ? "border-green-500" : "border-gray-600"
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
          weaponConflict={weaponConflict}
          artifactConflict={artifactConflict}
        />
      </div>
      {pressProgress > 0 && <PressProgressRing progress={pressProgress} />}
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
            className="rounded border bg-white px-2 py-1 text-sm font-normal text-black"
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
          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-1">
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

            <div className="col-span-5">
              <p className="mb-1 text-base font-bold">Artifacts</p>
              <div className="grid grid-cols-5 gap-2">
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
  initialCollections,
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
  initialCollections: CollectionItem[];
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
  // Same staleness fix, same reason, for the saved collections list.
  const [collections, setCollections] = useState(initialCollections);
  const [prevInitialCollections, setPrevInitialCollections] = useState(initialCollections);
  if (initialCollections !== prevInitialCollections) {
    setPrevInitialCollections(initialCollections);
    setCollections(initialCollections);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  // null outside "collection mode"; set by "Create collection"/"Edit
  // collection" below. Mirrors TeamManager's own groupDraft (teams/
  // team-manager.tsx) -- collectionId is null while CREATING (nothing to
  // update yet) and the saved collection's own id while editing. buildIds
  // is the in-progress draft selection, in the order builds were added to
  // it (appended on select, spliced out on deselect) -- what the saved
  // collection's own "order selected" display (CollectionBuild's own
  // schema comment) ends up reflecting once this is saved.
  const [collectionDraft, setCollectionDraft] = useState<{
    collectionId: number | null;
    name: string;
    buildIds: number[];
  } | null>(null);
  // A server-side error from the last save attempt -- distinct from the
  // live validation below, which is purely derived from the current
  // builds/draft and never itself an error object.
  const [collectionSaveError, setCollectionSaveError] = useState<string | null>(null);
  const inCollectionMode = collectionDraft !== null;

  // Which dropdown entry is selected -- null is "All builds" (the
  // default). Reset to null whenever the selected collection no longer
  // exists (e.g. deleted in another tab), same render-time adjustment
  // TeamManager's own selectedGroupId uses.
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  if (selectedCollectionId !== null && !collections.some((c) => c.id === selectedCollectionId)) {
    setSelectedCollectionId(null);
  }
  const selectedCollection =
    selectedCollectionId !== null ? collections.find((c) => c.id === selectedCollectionId) : undefined;

  // Whether the grid's own order currently carries meaning -- either
  // viewing one specific saved collection (its own saved order), or
  // editing one (selected-first, see displayedBuilds below) -- and so
  // must NOT be disturbed by the ordinary sort dropdown. Creating a
  // brand-new collection doesn't count: nothing is selected yet, so
  // there's nothing worth bumping, same reasoning TeamManager's own
  // displayedTeams comment gives for groupDraft.groupId === null.
  const fixedOrderActive =
    (!inCollectionMode && selectedCollection !== undefined) ||
    (collectionDraft !== null && collectionDraft.collectionId !== null);

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

  // While viewing one specific saved collection outside collection mode,
  // the grid is scoped to exactly that collection's own builds, in ITS
  // saved order; while editing one (collectionDraft.collectionId !==
  // null), every currently-selected build is bumped to the top of the
  // FULL list instead, in the draft's own order, so the ones the user
  // came here to review/change are immediately visible rather than
  // buried among every other build -- same two cases, same reasoning, as
  // TeamManager's own displayedTeams (teams/team-manager.tsx). Creating a
  // brand-new collection (collectionDraft.collectionId === null) falls
  // through to the plain `builds` order instead -- nothing's selected yet
  // to bump.
  const orderedBuilds =
    !inCollectionMode && selectedCollection
      ? selectedCollection.buildIds
          .map((buildId) => builds.find((b) => b.id === buildId))
          .filter((b): b is BuildItem => b !== undefined)
      : collectionDraft && collectionDraft.collectionId !== null
        ? [...builds].sort((a, b) => {
            const aIndex = collectionDraft.buildIds.indexOf(a.id);
            const bIndex = collectionDraft.buildIds.indexOf(b.id);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return 0;
          })
        : builds;

  // fixedOrderActive uses filterBuilds (filter only, no sort) so it never
  // disturbs the saved/selected-first order just established above; every
  // other case still goes through the ordinary filterAndSortBuilds, sort
  // dropdown included (see its own row below, hidden while fixedOrderActive).
  const filterCriteria = { buildNameSearch, characterNameSearch, elementFilter, weaponTypeFilter, rarityFilter };
  const orderedAndFiltered = fixedOrderActive
    ? filterBuilds(orderedBuilds, filterCriteria)
    : filterAndSortBuilds(orderedBuilds, { ...filterCriteria, sortKey, sortDirection });

  // Candidate exclusion while in collection mode -- hides (not dims) any
  // not-yet-selected build that would conflict with the draft's current
  // selection, per the user's own explicit call (availableCollectionBuilds'
  // own comment). A no-op outside collection mode.
  const filtered =
    inCollectionMode && collectionDraft ? availableCollectionBuilds(orderedAndFiltered, collectionDraft.buildIds) : orderedAndFiltered;

  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);
  const editingBuild = editingId === null ? null : (builds.find((b) => b.id === editingId) ?? null);
  const editingCharacter = editingBuild
    ? (characters.find((c) => c.ownedCharacterId === editingBuild.ownedCharacterId) ?? null)
    : null;
  const activeId = editingId ?? pendingDeleteId;

  // Live, non-blocking validation of the in-progress draft, via
  // computeCollectionConflicts -- only ever shared-weapon/shared-artifact
  // (duplicate-character/exclusivityGroup conflicts can't reach here at
  // all, see availableCollectionBuilds' own comment), but still a hard
  // block on Save, same as Groups' own groupDraftConflicts.
  const collectionDraftMembers = collectionDraft
    ? collectionDraft.buildIds.map((id) => builds.find((b) => b.id === id)).filter((b): b is BuildItem => b !== undefined)
    : [];
  const collectionDraftConflicts = collectionDraft ? computeCollectionConflicts(collectionDraftMembers) : [];

  // Whether each saved collection's OWN current members have drifted into
  // conflict since it was last saved (a build's weapon/artifacts can
  // change after the fact, same reasoning computeTeamConflicts/
  // computeCollectionConflicts already have) -- computed for every
  // collection up front, same as TeamManager's own groupConflictById, so
  // the dropdown itself can flag a drifted collection before it's opened.
  const collectionConflictById = new Map(
    collections.map((collection) => [
      collection.id,
      computeCollectionConflicts(
        collection.buildIds.map((id) => builds.find((b) => b.id === id)).filter((b): b is BuildItem => b !== undefined)
      ).length > 0,
    ])
  );

  // Per-card conflict ring flags (BuildPortrait's own weaponConflict/
  // artifactConflict props) -- the in-progress draft's own conflicts while
  // in collection mode, or the selected saved collection's own (possibly
  // drifted) conflicts while just viewing one, same source either way:
  // conflicts are only ever meaningful against a specific set of members,
  // never the full unscoped build list.
  const activeCollectionConflicts = inCollectionMode
    ? collectionDraftConflicts
    : selectedCollection
      ? computeCollectionConflicts(
          selectedCollection.buildIds.map((id) => builds.find((b) => b.id === id)).filter((b): b is BuildItem => b !== undefined)
        )
      : [];

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
    const { teamNames, collectionNames } = await getBuildContainerNames(buildId);
    const containerLabels = [
      ...teamNames.map((name) => `team "${name}"`),
      ...collectionNames.map((name) => `collection "${name}"`),
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
    // Deleting a build is reachable from collection mode too (via a long
    // press into BuildEditor, see BuildCard's own comment) -- if it was
    // part of the in-progress draft selection, drop it from there as
    // well, same as TeamManager's own handleDelete does for groupDraft.
    if (collectionDraft) {
      setCollectionDraft((prev) => (prev ? { ...prev, buildIds: prev.buildIds.filter((id) => id !== buildId) } : prev));
    }
  }

  function handleCreateCollection() {
    setCollectionDraft({ collectionId: null, name: "New Collection", buildIds: [] });
    setCollectionSaveError(null);
  }

  function handleEditCollection() {
    if (!selectedCollection) return;
    setCollectionDraft({ collectionId: selectedCollection.id, name: selectedCollection.name, buildIds: [...selectedCollection.buildIds] });
    setCollectionSaveError(null);
  }

  // Only deletes the Collection/CollectionBuild rows -- same as deleting a
  // Team/Group, this never touches the builds themselves, just the saved
  // combination of them.
  async function handleDeleteCollection() {
    if (!selectedCollection) return;
    const collectionId = selectedCollection.id;
    const confirmed = await confirm(`Delete the collection "${selectedCollection.name}"? This can't be undone.`, {
      title: "Delete collection",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(() => {
      const previous = collections;
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
      setSelectedCollectionId(null);
      deleteCollection(collectionId).catch(() => setCollections(previous));
    });
  }

  function handleCancelCollectionMode() {
    setCollectionDraft(null);
    setCollectionSaveError(null);
  }

  function handleToggleCollectionBuild(buildId: number) {
    setCollectionDraft((prev) => {
      if (!prev) return prev;
      // Splice out on deselect, append on select -- same "order selected"
      // reasoning TeamManager's own handleToggleGroupTeam gives: a build
      // re-added after being removed goes back to the END of the order,
      // not its old position.
      const buildIds = prev.buildIds.includes(buildId)
        ? prev.buildIds.filter((id) => id !== buildId)
        : [...prev.buildIds, buildId];
      return { ...prev, buildIds };
    });
  }

  function handleSaveCollection() {
    if (!collectionDraft) return;
    const draft = collectionDraft;
    startTransition(async () => {
      const result =
        draft.collectionId === null
          ? await createCollection(draft.name, draft.buildIds)
          : await updateCollection(draft.collectionId, draft.name, draft.buildIds);
      if ("errors" in result) {
        setCollectionSaveError(result.errors.name?.[0] ?? "Couldn't save this collection.");
        return;
      }
      if ("error" in result) {
        setCollectionSaveError(result.error);
        return;
      }
      const saved: CollectionItem = { id: result.collection.id, name: result.collection.name, buildIds: draft.buildIds };
      setCollections((prev) => {
        const next = prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
        return [...next].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedCollectionId(saved.id);
      setCollectionDraft(null);
      setCollectionSaveError(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {header}

        {/* Hidden while viewing a specific collection outside collection
            mode -- creating a plain build there wouldn't belong to the
            collection being viewed, which would read as it silently
            vanishing. Same condition as TeamManager's own "New Team"
            button (teams/team-manager.tsx). */}
        {(inCollectionMode || !selectedCollection) && (
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
            className="flex items-center gap-1.5 cursor-pointer appearance-none rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
          >
            {/* PlusIcon, not the Unicode "+" -- see its own comment on
                why a Unicode glyph can't be reliably centered against
                plain text via CSS alone. */}
            <PlusIcon />
            <span className="leading-none">Create build</span>
          </button>
        )}
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
            className="w-72 rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <input
            type="text"
            placeholder="Search by character name..."
            value={characterNameSearch}
            onChange={(event) => {
              setCharacterNameSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 py-2 text-sm text-black"
          />
          {/* Hidden whenever the grid's own order already carries meaning
              (a saved collection's own order, or selected-first while
              editing one) -- fixedOrderActive's own comment above. */}
          {!fixedOrderActive && (
            <>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as BuildSortKey)}
                className="h-[38px] rounded border bg-white px-2 text-sm text-black"
              >
                <option value="obtained">Sort: Added</option>
                <option value="character">Sort: Character</option>
              </select>
              <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
            </>
          )}
        </div>

        {/* "Collection mode" -- see collectionDraft's own comment. Same
            shape as TeamManager's own group-mode panel/dropdown row
            (teams/team-manager.tsx), minus the team-indirection layer. */}
        {collectionDraft ? (
          <div
            className={`space-y-2 rounded-lg border bg-blue-500/5 p-3 ${
              collectionDraftConflicts.length > 0 || collectionDraft.buildIds.length === 0 ? "border-red-500" : "border-blue-500"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold" htmlFor="collection-draft-name">
                Collection name:
              </label>
              <input
                id="collection-draft-name"
                type="text"
                autoFocus
                value={collectionDraft.name}
                onChange={(event) => setCollectionDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                className="w-64 rounded border bg-white px-2 py-1 text-sm text-black"
              />
              <span className="text-sm text-gray-300">
                {collectionDraft.buildIds.length} build{collectionDraft.buildIds.length === 1 ? "" : "s"} selected
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelCollectionMode}
                  className="rounded border bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCollection}
                  disabled={
                    collectionDraftConflicts.length > 0 || collectionDraft.name.trim() === "" || collectionDraft.buildIds.length === 0
                  }
                  className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-black"
                >
                  Save collection
                </button>
              </div>
            </div>
            {/* Live, not a save-time response -- re-evaluated on every
                selection change. Weapon/artifact-only (duplicate-character/
                exclusivityGroup conflicts can't reach here, see
                availableCollectionBuilds' own comment), one line per
                conflict via describeCollectionConflict. */}
            {collectionDraftConflicts.length > 0 && (
              <ul className="space-y-1 text-sm text-red-500">
                {collectionDraftConflicts.map((conflict, index) => (
                  <li key={index}>
                    {describeCollectionConflict(conflict, collectionDraftMembers).map((part, partIndex) =>
                      part.type === "build" ? (
                        <span key={partIndex}>
                          {part.characterName} (<em>{part.buildName}</em>)
                        </span>
                      ) : (
                        <span key={partIndex}>{part.text}</span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
            {collectionDraft.buildIds.length === 0 && (
              <p className="text-sm text-red-500">A collection must contain at least one build.</p>
            )}
            {collectionSaveError && <p className="text-sm text-red-500">{collectionSaveError}</p>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCollectionId ?? ""}
              onChange={(event) => {
                setSelectedCollectionId(event.target.value === "" ? null : Number(event.target.value));
                setPage(1);
              }}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="">All builds</option>
              {collections.map((collection) => (
                <option
                  key={collection.id}
                  value={collection.id}
                  className={collectionConflictById.get(collection.id) ? "text-red-600" : undefined}
                >
                  {collection.name}
                  {collectionConflictById.get(collection.id) ? " (conflict)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateCollection}
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
            >
              {/* PlusIcon, not the Unicode "+" -- see its own comment. */}
              <PlusIcon />
              <span className="leading-none">Create collection</span>
            </button>
            {selectedCollection && (
              <>
                <button
                  type="button"
                  onClick={handleEditCollection}
                  className="flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
                >
                  <span className="leading-none">Edit collection</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCollection}
                  className="flex items-center rounded-full border border-red-600 px-4 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-600/10"
                >
                  <span className="leading-none">Delete collection</span>
                </button>
              </>
            )}
          </div>
        )}

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
          <p className="text-sm text-gray-300">
            {filtered.length} build{filtered.length === 1 ? "" : "s"}
          </p>
          <PaginationNavButtons currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>

        {/* The empty-state message replaces the <ul> rather than sitting
            inside it -- a <ul> may only directly contain <li>, and a <p>
            there reads to screen readers as a one-item list. */}
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-300">No builds match these filters.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((build) => {
              const conflictFlags = buildCollectionConflictFlags(build.id, activeCollectionConflicts);
              return (
                <BuildCard
                  key={build.id}
                  build={build}
                  isActive={build.id === activeId}
                  onEdit={() => setEditingId(build.id)}
                  collectionSelection={
                    collectionDraft
                      ? { selected: collectionDraft.buildIds.includes(build.id), onToggle: () => handleToggleCollectionBuild(build.id) }
                      : undefined
                  }
                  weaponConflict={conflictFlags.weaponConflict}
                  artifactConflict={conflictFlags.conflictingArtifactIds.length > 0}
                />
              );
            })}
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
            onCreated={(build) => {
              setBuilds((prev) => [...prev, build]);
              // Auto-selects a freshly created build into the in-progress
              // collection draft, per TeamManager's own identical
              // handleCreate behavior for a freshly created team.
              if (collectionDraft) {
                setCollectionDraft((prev) => (prev ? { ...prev, buildIds: [...prev.buildIds, build.id] } : prev));
              }
            }}
            onClose={() => setCreating(false)}
          />
        )}
      </div>
    </div>
  );
}
