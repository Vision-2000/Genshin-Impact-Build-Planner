"use client";

import { useState, useTransition } from "react";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { formatStatValue } from "@/lib/stat-format";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { TrashIcon } from "@/components/trash-icon";
import { MiniatureCard } from "@/components/miniature-card";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls } from "../pagination-controls";
import { removeArtifact, removeArtifacts, updateArtifact } from "./actions";
import { ArtifactCard } from "./artifact-card";
import { ArtifactSlotFilterRow } from "./artifact-slot-filter-row";
import { ArtifactProgressionForm } from "./artifact-progression-form";
import {
  ARTIFACT_RARITIES,
  MAIN_STAT_NAMES,
  SUBSTAT_TYPE_NAMES,
  computeArtifactMainStatValue,
  type SubstatTypeName,
} from "./artifact-rules";
import {
  filterAndSortOwnedArtifacts,
  type OwnedArtifactItem,
  type OwnedSortKey,
  type StatTypeOption,
} from "./filter-sort";

const PAGE_SIZE = 60;

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Extracted so the bulk-delete confirmation's MiniatureCard rows can show
// the exact same hover detail as the grid card without duplicating this JSX
// a second time.
function buildTooltipContent(artifact: OwnedArtifactItem) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <p className="text-base font-semibold text-yellow-100">{artifact.setName}</p>
        <p className="text-base font-semibold text-gray-400">+{artifact.level}</p>
      </div>
      <p className="mt-1 text-base font-semibold text-yellow-100">
        Main Stat: {artifact.mainStatName} +
        {formatStatValue(
          artifact.mainStatName,
          computeArtifactMainStatValue(artifact.mainStatName, artifact.rarity, artifact.level)
        )}
      </p>
      {artifact.substats.length > 0 && (
        <>
          <hr className="mt-2 border-gray-700" />
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {artifact.substats.map((substat) => (
              <p key={substat.id} className="text-gray-300">
                {substat.statTypeName} +{formatStatValue(substat.statTypeName, substat.value)}
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function OwnedArtifactManager({
  statTypes,
  initialOwnedArtifacts,
}: {
  statTypes: StatTypeOption[];
  initialOwnedArtifacts: OwnedArtifactItem[];
}) {
  useRefreshOnBackNavigation();
  const [owned, setOwned] = useState(initialOwnedArtifacts);
  // useState(initialOwnedArtifacts) only ever consults that argument on the
  // very first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialOwnedArtifacts, setPrevInitialOwnedArtifacts] = useState(initialOwnedArtifacts);
  if (initialOwnedArtifacts !== prevInitialOwnedArtifacts) {
    setPrevInitialOwnedArtifacts(initialOwnedArtifacts);
    setOwned(initialOwnedArtifacts);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const statTypeById = new Map(statTypes.map((s) => [s.id, s]));

  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState<Set<ArtifactSlot>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [substatFilter, setSubstatFilter] = useState<Set<SubstatTypeName>>(new Set());
  const [mainStatFilter, setMainStatFilter] = useState("");
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
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

  const filtered = filterAndSortOwnedArtifacts(owned, {
    search,
    slotFilter,
    rarityFilter,
    substatFilter,
    mainStatFilter,
    sortKey,
    sortDirection,
  });
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);
  const editingArtifact = editingId === null ? null : (owned.find((a) => a.id === editingId) ?? null);

  function handleSaveArtifact(
    ownedArtifactId: number,
    level: number,
    mainStatId: number,
    substats: { statTypeId: number; value: number }[]
  ) {
    const previous = owned;
    // Optimistic: apply level + main stat + substats locally. Real substat row
    // ids come back from the server; use placeholder negatives until then.
    setOwned((prev) =>
      prev.map((a) =>
        a.id === ownedArtifactId
          ? {
              ...a,
              level,
              mainStatId,
              mainStatName: statTypeById.get(mainStatId)?.name ?? a.mainStatName,
              substats: substats.map((s, i) => ({
                id: -(i + 1),
                statTypeId: s.statTypeId,
                statTypeName: statTypeById.get(s.statTypeId)?.name ?? "",
                value: s.value,
              })),
            }
          : a
      )
    );
    setEditingId(null);
    startTransition(async () => {
      const updated = await updateArtifact(ownedArtifactId, level, mainStatId, substats).catch(() => null);
      setOwned((prev) =>
        updated ? prev.map((a) => (a.id === ownedArtifactId ? updated : a)) : previous
      );
    });
  }

  async function handleRemoveArtifact(ownedArtifactId: number) {
    const confirmed = await confirm("Delete this artifact? This can't be undone.", {
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setEditingId((current) => (current === ownedArtifactId ? null : current));
    startTransition(() => {
      const previous = owned;
      setOwned((prev) => prev.filter((a) => a.id !== ownedArtifactId));
      removeArtifact(ownedArtifactId).catch(() => setOwned(previous));
    });
  }

  function handleEnterSelectMode() {
    setSelectMode(true);
    setSelectedIds(new Set());
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
      setOwned((prev) => prev.filter((a) => !selectedIds.has(a.id)));
      removeArtifacts(idsToDelete).catch(() => setOwned(previous));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by set name..."
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
          className="h-[38px] rounded border bg-white px-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
          <option value="level">Sort: Level</option>
          {SUBSTAT_TYPE_NAMES.map((name) => (
            <option key={name} value={name}>
              Sort: {name}
            </option>
          ))}
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
        <select
          value={mainStatFilter}
          onChange={(event) => {
            setMainStatFilter(event.target.value);
            setPage(1);
          }}
          className="h-[38px] rounded border bg-white px-2 text-sm text-black"
        >
          <option value="">Main stat: Any</option>
          {MAIN_STAT_NAMES.map((name) => (
            <option key={name} value={name}>
              Main stat: {name}
            </option>
          ))}
        </select>

        {selectMode ? (
          <>
            {/* h-[38px] on all 3 of these -- matches the row's other
                elements' own natural/explicit height; without it, the row
                container itself still sizes to whichever button happens to
                be tallest in the current mode (items-center above only
                stops OTHER elements from stretching, it doesn't equalize
                this). Fixing all 3 to the same explicit height removes
                that remaining source of mismatch in either mode. */}
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
            aria-label="Select artifacts to delete"
            title="Select artifacts to delete"
            className="flex h-[38px] items-center justify-center rounded bg-red-600 px-2 text-white hover:bg-red-700"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      <ArtifactSlotFilterRow
        slotFilter={slotFilter}
        onToggle={(slot) => {
          setSlotFilter((prev) => toggleInSet(prev, slot));
          setPage(1);
        }}
      />

      <RarityFilterRow
        rarities={ARTIFACT_RARITIES}
        rarityFilter={rarityFilter}
        onToggle={(rarity) => {
          setRarityFilter((prev) => toggleInSet(prev, rarity));
          setPage(1);
        }}
      />

      <div className="flex flex-wrap gap-2">
        {SUBSTAT_TYPE_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setSubstatFilter((prev) => toggleInSet(prev, name));
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              substatFilter.has(name) ? "bg-foreground text-background" : ""
            }`}
          >
            Substat: {name}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {selectMode
          // Counts selections across every filtered page, not just the one
          // currently shown -- `selectedIds.size` itself (used for the
          // Delete button) is the same number here, since a selection made
          // before narrowing a filter stays selected even once it's
          // filtered out of view, same reasoning as the weapons page.
          ? `${filtered.filter((a) => selectedIds.has(a.id)).length}/${filtered.length} artifact${filtered.length === 1 ? "" : "s"} selected`
          : `${filtered.length} artifact${filtered.length === 1 ? "" : "s"}`}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {pageItems.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            setName={artifact.setName}
            slot={artifact.slot}
            rarity={artifact.rarity}
            level={artifact.level}
            iconUrl={artifact.iconUrl}
            onSelect={() =>
              selectMode ? setSelectedIds((prev) => toggleInSet(prev, artifact.id)) : setEditingId(artifact.id)
            }
            selected={selectMode ? selectedIds.has(artifact.id) : undefined}
            tooltipContent={buildTooltipContent(artifact)}
          />
        ))}
        {pageItems.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">No artifacts match these filters.</p>
        )}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />

      <Modal
        open={editingArtifact !== null}
        onClose={() => setEditingId(null)}
        maxWidthClassName="max-w-4xl"
        fitContent
        closeButtonClassName="text-white hover:bg-white/10"
      >
        {editingArtifact && (
          <ArtifactProgressionForm
            key={editingArtifact.id}
            set={{
              name: editingArtifact.setName,
              rarity: editingArtifact.rarity,
              twoPieceEffect: editingArtifact.twoPieceEffect,
              fourPieceEffect: editingArtifact.fourPieceEffect,
            }}
            getSlotImageUrl={() => editingArtifact.iconUrl}
            statTypes={statTypes}
            initialSlot={editingArtifact.slot}
            slotFixed
            initialLevel={editingArtifact.level}
            initialMainStatId={editingArtifact.mainStatId}
            initialSubstats={editingArtifact.substats.map((s) => ({ statTypeId: s.statTypeId, value: s.value }))}
            formBackgroundClassName="bg-primary-page"
            submitLabel="Save"
            onSubmit={(input) => handleSaveArtifact(editingArtifact.id, input.level, input.mainStatId, input.substats)}
            onDelete={() => handleRemoveArtifact(editingArtifact.id)}
          />
        )}
      </Modal>

      <Modal
        open={confirmingBulkDelete}
        onClose={() => setConfirmingBulkDelete(false)}
        title={`Delete ${selectedIds.size} artifact${selectedIds.size === 1 ? "" : "s"}?`}
        // max-w-[610px] is a ceiling sized to EXACTLY 6 MiniatureCards per
        // row (6*84px cards + 5*8px gaps + the panel's own p-5 padding and
        // border, plus the scrollbar gutter reserved below) -- a looser
        // ceiling like max-w-2xl left visible empty space to the right
        // once a selection large enough to wrap kicked in, since cards
        // would still only fill 6-per-row's own width inside a wider box.
        // fitContent then shrinks the panel below this ceiling too, for a
        // selection of 6 or fewer that doesn't need to wrap at all.
        maxWidthClassName="max-w-[610px]"
        fitContent
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
              .filter((artifact) => selectedIds.has(artifact.id))
              .map((artifact) => (
                <MiniatureCard
                  key={artifact.id}
                  iconUrl={artifact.iconUrl}
                  alt={artifact.setName}
                  rarity={artifact.rarity}
                  objectFit="contain"
                  hoverContent={buildTooltipContent(artifact)}
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
