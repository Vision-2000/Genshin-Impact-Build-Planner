"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import { DEFAULT_WEAPON, DEFAULT_WEAPON_RARITY } from "@/lib/default-weapon";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls } from "../pagination-controls";
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
  // Same loaded-flag/spinner-overlay technique as CharacterCard/
  // ArtifactCard/WeaponCard -- a freshly-started dev server (or just a
  // cold browser cache) has never fetched this portrait before, and Image
  // renders nothing at all while it's in flight, reading as a wall of
  // blank cards on a page full of builds. No key={build.characterIconUrl}
  // reset here -- unlike WeaponCard, this component is never reused for a
  // different build's icon in place (each card is keyed by build.id at
  // the list level, same as CharacterCard's own reasoning).
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <li className="relative">
      <div
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onEdit();
        }}
        className={`w-full cursor-pointer overflow-hidden rounded-xl border-8 shadow hover:opacity-90 ${
          isActive ? "border-blue-500" : "border-gray-600"
        } ${rarityGradientClasses(build.characterRarity)}`}
      >
        <div className="relative aspect-[4/3] w-full">
          {build.characterIconUrl && (
            <>
              {/* Always rendered, never conditionally removed -- opacity
                  toggled by a class instead, so the very first client
                  render (imageLoaded still false, same as the server)
                  produces an identical tree. Structurally adding/removing
                  this node based on load state caused a hydration
                  mismatch for any image that happened to resolve from
                  cache fast enough to flip imageLoaded before hydration's
                  diff settled. */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity ${imageLoaded ? "opacity-0" : "opacity-100"}`}
              >
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              </div>
              <Image
                src={build.characterIconUrl}
                alt=""
                fill
                sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
                className="object-cover"
                onLoad={() => setImageLoaded(true)}
              />
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
            <p className="truncate text-center text-sm font-semibold text-white">{build.name}</p>
            <p className="truncate text-center text-xs text-gray-300">{build.characterName}</p>
          </div>
        </div>

        <div className="space-y-1.5 bg-background px-2 py-1.5">
          <div className="flex items-center gap-2">
            {/* No real weapon chosen falls back to the character's own
                1-star starter weapon -- same as WeaponSlotPicker's empty
                state (see DEFAULT_WEAPON's own comment), not a blank slot. */}
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded p-0.5 ${rarityGradientClasses(
                build.weaponIconUrl ? (build.weaponRarity ?? 1) : DEFAULT_WEAPON_RARITY
              )}`}
            >
              <Image
                src={build.weaponIconUrl ?? DEFAULT_WEAPON[build.characterWeaponType].iconUrl}
                alt=""
                width={52}
                height={52}
              />
            </div>

            {build.activeSetEffects.length > 0 && (
              <div className="ml-auto flex items-center gap-1.5">
                {build.activeSetEffects.map((effect) => (
                  <div
                    key={effect.setName}
                    title={`${effect.setName} (${effect.maxPiece}pc)`}
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded p-0.5 ${rarityGradientClasses(effect.rarity)}`}
                  >
                    {effect.flowerIconUrl && (
                      <Image src={effect.flowerIconUrl} alt={effect.setName} width={50} height={50} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
}: {
  build: BuildItem;
  character: OwnedCharacterOption;
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  onSave: (draft: BuildEditDraft) => void;
  onDelete: () => void;
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

  return (
    <div className="space-y-4">
      {/* Same top row shape as BuildCatalog's own (name + form-level
          actions) -- Delete alongside Save here, since this form has both:
          deleting is still immediate (a separately confirmed, already-
          destructive action, not part of the staged draft), Save is what
          commits the staged name/weapon/artifacts. Same Delete/Save
          styling and placement as WeaponProgressionForm/
          ArtifactProgressionForm (solid red, directly left of Save). */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded border p-4">
        <label className="block text-sm">
          Name:
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="ml-1 rounded border bg-white px-2 py-1 text-sm text-black"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Delete build
          </button>
          <button
            type="button"
            onClick={() => onSave({ name: name.trim() || build.name, ownedWeaponId: weaponId, slots })}
            className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            Save build
          </button>
        </div>
      </div>

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
    </div>
  );
}

export function OwnedBuildManager({
  header,
  characters,
  weapons,
  artifacts,
  initialBuilds,
}: {
  // The page's own title block -- rendered on the same row as "Create
  // build", same header shape every other page uses (see page.tsx's own
  // comment on why that row lives in here).
  header: ReactNode;
  characters: OwnedCharacterOption[];
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  initialBuilds: BuildItem[];
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

  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  // "obtained" (not "name") -- matches the owned pages' own default
  // exactly, not just offering the same option (see BuildSortKey's own
  // comment on why build name isn't one of the options at all anymore).
  const [sortKey, setSortKey] = useState<BuildSortKey>("obtained");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
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
    search,
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
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          <span className="text-base leading-none">+</span> Create build
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by build or character name..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 py-2 text-sm text-black"
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

        <p className="text-sm text-gray-500 dark:text-gray-300">
          {filtered.length} build{filtered.length === 1 ? "" : "s"}
        </p>

        {/* The empty-state message replaces the <ul> rather than sitting
            inside it -- a <ul> may only directly contain <li>, and a <p>
            there reads to screen readers as a one-item list. */}
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-500">No builds match these filters.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

        <Modal
          open={editingBuild !== null}
          onClose={() => setEditingId(null)}
          maxWidthClassName="max-w-7xl"
          hideCloseButton
        >
          {editingBuild && editingCharacter && (
            <BuildEditor
              key={editingBuild.id}
              build={editingBuild}
              character={editingCharacter}
              weapons={weapons}
              artifacts={artifacts}
              onSave={(draft) => handleSaveEdit(editingBuild, draft)}
              onDelete={() => handleDelete(editingBuild.id)}
            />
          )}
        </Modal>

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
