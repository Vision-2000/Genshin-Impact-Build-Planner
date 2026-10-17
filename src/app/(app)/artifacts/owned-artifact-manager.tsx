"use client";

import { useState, useTransition } from "react";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { formatStatValue } from "@/lib/stat-format";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls } from "../pagination-controls";
import { removeArtifact, updateArtifact } from "./actions";
import { ArtifactCard } from "./artifact-card";
import { ArtifactSlotFilterRow } from "./artifact-slot-filter-row";
import { ArtifactProgressionForm } from "./artifact-progression-form";
import { ARTIFACT_RARITIES, MAIN_STAT_NAMES, SUBSTAT_TYPE_NAMES, type SubstatTypeName } from "./artifact-rules";
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
        {filtered.length} artifact{filtered.length === 1 ? "" : "s"}
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
            actionLabel="Delete"
            onAction={() => handleRemoveArtifact(artifact.id)}
            danger
            onSelect={() => setEditingId(artifact.id)}
            tooltipContent={
              <>
                <div className="flex items-baseline gap-2">
                  <p className="text-base font-semibold text-yellow-100">{artifact.setName}</p>
                  <p className="text-base font-semibold text-gray-400">+{artifact.level}</p>
                </div>
                <p className="mt-1 text-base font-semibold text-yellow-100">Main Stat: {artifact.mainStatName}</p>
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
            }
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
    </div>
  );
}
