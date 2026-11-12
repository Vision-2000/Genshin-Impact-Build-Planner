"use client";

import { useState, useTransition } from "react";
import { WeaponType } from "@/generated/prisma/enums";
import { useDialogs } from "@/components/dialog-provider";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { paginate } from "@/lib/paginate";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { TrashIcon } from "@/components/trash-icon";
import { MiniatureCard } from "@/components/miniature-card";
import type { SortDirection } from "@/lib/sort";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { PaginationControls, PaginationNavButtons } from "../pagination-controls";
import { WeaponCard, WeaponHoverCardContent } from "./weapon-card";
import { removeWeapon, removeWeapons, updateWeaponProgression } from "./actions";
import type { UpdateWeaponProgressionInput } from "./schemas";
import { WeaponProgressionForm } from "./weapon-progression-form";
import {
  filterAndSortOwnedWeapons,
  WEAPON_SECONDARY_STAT_NAMES,
  type OwnedWeaponItem,
  type OwnedSortKey,
} from "./filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];
// Same page size as Builds/Artifacts -- it turns out to be just as easy to
// accumulate more weapons than any of those (every pull/craft is its own
// copy, and there's no reason to ever delete one that's still usable on
// some character), so this page needs the same "genuinely unbounded"
// treatment, not the "bounded, render it all" treatment Characters still
// gets.
const PAGE_SIZE = 60;

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function OwnedWeaponManager({ initialOwnedWeapons }: { initialOwnedWeapons: OwnedWeaponItem[] }) {
  useRefreshOnBackNavigation();
  const [owned, setOwned] = useState(initialOwnedWeapons);
  // useState(initialOwnedWeapons) only ever consults that argument on the
  // very first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialOwnedWeapons, setPrevInitialOwnedWeapons] = useState(initialOwnedWeapons);
  if (initialOwnedWeapons !== prevInitialOwnedWeapons) {
    setPrevInitialOwnedWeapons(initialOwnedWeapons);
    setOwned(initialOwnedWeapons);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const [search, setSearch] = useState("");
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [secondaryStatFilter, setSecondaryStatFilter] = useState("");
  const [sortKey, setSortKey] = useState<OwnedSortKey>("obtained");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Bulk-delete select mode -- selectedIds is intentionally independent of
  // `filtered` below, so a selection made before narrowing a filter survives
  // the narrowing instead of silently shrinking (the status line and
  // Delete button reflect this differently: see their own comments).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  const filtered = filterAndSortOwnedWeapons(owned, {
    search,
    weaponTypeFilter,
    rarityFilter,
    secondaryStatFilter,
    sortKey,
    sortDirection,
  });
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);
  const editingWeapon = editingId === null ? null : (owned.find((w) => w.id === editingId) ?? null);
  // Drives the select-all/unselect-all toggle button below -- true only
  // once every CURRENTLY FILTERED item is selected (an empty filtered list
  // never counts as "all selected").
  const allFilteredSelected = filtered.length > 0 && filtered.every((weapon) => selectedIds.has(weapon.id));

  function handleUpdateProgression(ownedWeaponId: number, input: UpdateWeaponProgressionInput) {
    const previous = owned;
    // Optimistic merge only covers level/ascensionPhase/refinement -- the
    // server response below replaces the whole item once it lands, which
    // is what actually refreshes hoverDetail (that copy's own stats/
    // passive) to match the new state instead of leaving it stuck at
    // whatever it was computed at on the last full page load.
    setOwned((prev) => prev.map((weapon) => (weapon.id === ownedWeaponId ? { ...weapon, ...input } : weapon)));
    setEditingId(null);

    startTransition(async () => {
      const result = await updateWeaponProgression(ownedWeaponId, input).catch(() => ({ errors: {} }) as const);
      if ("errors" in result) {
        setOwned(previous);
        return;
      }
      setOwned((prev) => prev.map((weapon) => (weapon.id === ownedWeaponId ? result.weapon : weapon)));
    });
  }

  async function handleRemove(ownedWeaponId: number) {
    const confirmed = await confirm("Delete this weapon? This can't be undone.", {
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    startTransition(() => {
      const previous = owned;
      setOwned((prev) => prev.filter((weapon) => weapon.id !== ownedWeaponId));
      removeWeapon(ownedWeaponId).catch(() => setOwned(previous));
    });
  }

  function handleEnterSelectMode() {
    setSelectMode(true);
    setSelectedIds(new Set());
  }

  // Unions with the existing selection rather than replacing it -- a
  // selection made before narrowing a filter stays selected (see this
  // component's own selectedIds comment), so selecting everything in the
  // current filter should only ever grow the set, never drop something the
  // user already picked that's since scrolled out of view. Toggles to
  // unselecting just the current filter's own ids (not the whole
  // selection) once every one of them is already selected -- anything
  // selected outside the current filter stays selected either way.
  function handleToggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const weapon of filtered) next.delete(weapon.id);
        return next;
      }
      return new Set([...prev, ...filtered.map((weapon) => weapon.id)]);
    });
  }

  function handleCancelSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleConfirmBulkDelete() {
    const idsToDelete = [...selectedIds];
    setConfirmingBulkDelete(false);
    setSelectMode(false);
    setSelectedIds(new Set());

    startTransition(() => {
      const previous = owned;
      setOwned((prev) => prev.filter((weapon) => !selectedIds.has(weapon.id)));
      removeWeapons(idsToDelete).catch(() => setOwned(previous));
    });
  }

  return (
    <div className="space-y-4">
      {/* items-center -- without it, flex's default align-items: stretch
          made every child match the row's tallest element's height. The
          icon-only select-mode button (no border, taller padding+icon than
          the bordered text inputs/selects) was briefly that tallest element,
          stretching the whole row a couple pixels taller while visible,
          then letting it visibly shrink back once replaced by the
          same-height Cancel/Delete buttons in select mode. items-center
          keeps every child at its own natural height instead, in both
          modes. */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as OwnedSortKey)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="obtained">Sort: Added</option>
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
          <option value="refinement">Sort: Refinement</option>
          <option value="level">Sort: Level</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
        <select
          value={secondaryStatFilter}
          onChange={(event) => {
            setSecondaryStatFilter(event.target.value);
            setPage(1);
          }}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="">Weapon stat: Any</option>
          {WEAPON_SECONDARY_STAT_NAMES.map((name) => (
            <option key={name} value={name}>
              Weapon stat: {name}
            </option>
          ))}
        </select>

        {selectMode ? (
          <>
            {/* h-[38px] on both of these -- matches the inputs/selects'
                own natural height (border + py-2 + text-sm), which their
                own borderless/icon-sized content wouldn't reproduce on its
                own (see this row's own items-center comment above: that
                fixed the OTHER elements getting stretched, but not the row
                container itself still sizing to whichever button happens
                to be tallest in the current mode). Fixing both to the
                same explicit height removes that remaining source of
                mismatch entirely, in either mode. */}
            <button
              type="button"
              onClick={handleCancelSelectMode}
              className="h-[38px] rounded border bg-white px-3 text-sm text-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setConfirmingBulkDelete(true)}
              disabled={selectedIds.size === 0}
              className="flex h-[38px] items-center gap-1.5 rounded bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600"
            >
              <TrashIcon className="h-5 w-5" />
              Delete ({selectedIds.size})
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleEnterSelectMode}
            aria-label="Select weapons to delete"
            title="Select weapons to delete"
            className="flex h-[38px] items-center justify-center rounded bg-red-600 px-2 text-white hover:bg-red-700"
          >
            <TrashIcon />
          </button>
        )}
      </div>

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

      {/* min-h-8 -- same fix as the Teams/Builds/Artifacts
          pages' own top row: without a reserved height, crossing into a
          2nd page grows this row (PaginationNavButtons' own buttons are
          taller than the count text alone) and visibly shifts the grid
          below it down. */}
      <div className="flex min-h-8 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {selectMode
              // Counts only currently-visible selections against the visible
              // total -- `selectedIds.size` itself (used for the Delete
              // button) can be larger, since a selection made before
              // narrowing a filter stays selected even once it's filtered
              // out of view.
              ? `${filtered.filter((weapon) => selectedIds.has(weapon.id)).length}/${filtered.length} weapon${filtered.length === 1 ? "" : "s"} selected`
              : `${filtered.length} weapon${filtered.length === 1 ? "" : "s"}`}
          </p>
          {selectMode && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="rounded border px-2 py-1 text-xs transition-colors hover:bg-foreground/10"
            >
              {allFilteredSelected ? "Unselect all" : "Select all"}
            </button>
          )}
        </div>
        <PaginationNavButtons currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {pageItems.map((weapon) => (
          <WeaponCard
            key={weapon.id}
            name={weapon.name}
            weaponType={weapon.weaponType}
            rarity={weapon.rarity}
            secondaryStatName={weapon.secondaryStatName}
            iconUrl={weapon.iconUrl}
            refinement={weapon.refinement}
            level={weapon.level}
            onSelect={() =>
              selectMode ? setSelectedIds((prev) => toggleInSet(prev, weapon.id)) : setEditingId(weapon.id)
            }
            selected={selectMode ? selectedIds.has(weapon.id) : undefined}
            hoverDetail={weapon.hoverDetail}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No weapons match these filters.</p>}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />

      <Modal
        open={editingWeapon !== null}
        onClose={() => setEditingId(null)}
        // max-w-4xl (not -3xl) -- fitContent means this is only a
        // ceiling, never a floor, but Disaster and Remorse's passive (by
        // far the longest of any weapon) needed more width than -3xl left
        // to wrap at before the modal ran out of room to actually honor
        // "expand horizontally to fit the content" at all. Every other
        // weapon's own content stays its own, narrower natural width
        // regardless of this ceiling being higher.
        maxWidthClassName="max-w-4xl"
        fitContent
        closeButtonClassName="text-white hover:bg-white/10"
      >
        {editingWeapon && (
          <WeaponProgressionForm
            key={editingWeapon.id}
            weaponId={editingWeapon.weaponId}
            name={editingWeapon.name}
            weaponType={editingWeapon.weaponType}
            rarity={editingWeapon.rarity}
            splashUrl={editingWeapon.splashUrl}
            secondaryStatName={editingWeapon.secondaryStatName}
            initialLevel={editingWeapon.level}
            initialAscensionPhase={editingWeapon.ascensionPhase}
            initialRefinement={editingWeapon.refinement}
            formBackgroundClassName="bg-primary-page"
            submitLabel="Save"
            onSubmit={(input) => handleUpdateProgression(editingWeapon.id, input)}
            onDelete={() => handleRemove(editingWeapon.id)}
          />
        )}
      </Modal>

      <Modal
        open={confirmingBulkDelete}
        onClose={() => setConfirmingBulkDelete(false)}
        title={`Delete ${selectedIds.size} weapon${selectedIds.size === 1 ? "" : "s"}?`}
        // max-w-[610px] is sized to EXACTLY 6 MiniatureCards per row
        // (6*84px cards + 5*8px gaps + the panel's own p-5 padding and
        // border, plus the scrollbar gutter reserved below) -- no
        // fitContent (unlike the edit-progression modal below), so the
        // panel always renders at this same full width regardless of how
        // many cards there are, rather than shrinking for a small
        // selection and only reaching this width once wrapping kicks in.
        maxWidthClassName="max-w-[610px]"
      >
        <div className="space-y-4">
          <p className="text-sm">This can&apos;t be undone.</p>
          {/* max-h -- caps this at 3 rows' worth (84px cards + gap-2 gaps)
              before scrolling, so a large selection doesn't grow the modal
              past the screen instead. [scrollbar-gutter:stable] -- same
              fix as the app shell's own <main> (see layout.tsx's own
              comment): reserves the scrollbar's width ALWAYS, whether or
              not it's actually showing, so a selection large enough to
              need scrolling doesn't shrink the 6-card row down to 5 once
              the real scrollbar eats into the same space the ceiling above
              was sized for. */}
          <div className="flex max-h-[268px] flex-wrap gap-2 overflow-y-auto [scrollbar-gutter:stable]">
            {owned
              .filter((weapon) => selectedIds.has(weapon.id))
              .map((weapon) => (
                <MiniatureCard
                  key={weapon.id}
                  iconUrl={weapon.iconUrl}
                  alt={weapon.name}
                  rarity={weapon.rarity}
                  objectFit="cover"
                  hoverContent={
                    <WeaponHoverCardContent
                      name={weapon.name}
                      secondaryStatName={weapon.secondaryStatName}
                      level={weapon.level}
                      refinement={weapon.refinement}
                      hoverDetail={weapon.hoverDetail}
                    />
                  }
                />
              ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingBulkDelete(false)}
              className="rounded px-3 py-1.5 text-sm transition-colors hover:bg-foreground/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmBulkDelete}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-80"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
