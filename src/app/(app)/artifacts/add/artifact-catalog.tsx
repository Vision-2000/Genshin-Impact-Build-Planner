"use client";

import { useState, useTransition } from "react";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { useToast, Toast } from "@/components/toast";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { ArtifactCard } from "../artifact-card";
import { addArtifact } from "../actions";
import { ArtifactProgressionForm, type ArtifactProgressionInput } from "../artifact-progression-form";
import {
  ARTIFACT_RARITIES,
  OTHER_TWO_PIECE_BONUS,
  SLOT_MAIN_STATS,
  TWO_PIECE_BONUS_STAT_NAMES,
  maxLevelForRarity,
} from "../artifact-rules";
import {
  filterArtifactSetCatalog,
  slotIconUrl,
  type ArtifactSetCatalogItem,
  type CatalogSortKey,
  type StatTypeOption,
} from "../filter-sort";

// Every 2pc-effect filter dropdown option, in order -- the real stat
// names followed by the "Others" catch-all for sets with no 2pc stat
// bonus row.
const TWO_PIECE_FILTER_VALUES: readonly string[] = [...TWO_PIECE_BONUS_STAT_NAMES, OTHER_TWO_PIECE_BONUS];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ArtifactCatalog({
  catalog,
  statTypes,
}: {
  catalog: ArtifactSetCatalogItem[];
  statTypes: StatTypeOption[];
}) {
  const [, startTransition] = useTransition();
  const { message, visible, showToast } = useToast();

  const statTypeByName = new Map(statTypes.map((s) => [s.name, s]));

  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [twoPieceStatFilter, setTwoPieceStatFilter] = useState("");
  const [sortKey, setSortKey] = useState<CatalogSortKey>("release");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const filtered = filterArtifactSetCatalog(catalog, {
    search,
    rarityFilter,
    twoPieceStatFilter,
    sortKey,
    sortDirection,
  });

  function toggleRarity(rarity: number) {
    setRarityFilter((prev) => toggleInSet(prev, rarity));
  }

  // The set currently open in the "add a piece" modal -- a plain id (not
  // the row itself) so re-deriving addingSet below always reflects the
  // latest catalog prop, same reasoning as every other editingId-style
  // state in this codebase.
  const [addingSetId, setAddingSetId] = useState<number | null>(null);
  const addingSet = addingSetId === null ? null : catalog.find((s) => s.id === addingSetId) ?? null;

  function closeAddForm() {
    setAddingSetId(null);
  }

  function handleAddSubmit(set: ArtifactSetCatalogItem, input: ArtifactProgressionInput) {
    startTransition(async () => {
      try {
        await addArtifact(set.id, input.slot, input.level, input.mainStatId, input.substats);
        // Deliberately not calling closeAddForm() -- keeping the modal
        // open (ArtifactProgressionForm isn't remounted since addingSetId
        // doesn't change) with the form's values in place lets the user
        // save a duplicate/near-duplicate piece without re-entering
        // everything.
        showToast(
          <>
            Added <span className="font-bold">{set.name}</span> · {input.slot} · {set.rarity}★
          </>
        );
      } catch {
        // Nothing was added, nothing to revert.
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by set name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as CatalogSortKey)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="release">Sort: Release</option>
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
        <select
          value={twoPieceStatFilter}
          onChange={(event) => setTwoPieceStatFilter(event.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="">2pc stat: Any</option>
          {TWO_PIECE_FILTER_VALUES.map((name) => (
            <option key={name} value={name}>
              2pc stat: {name}
            </option>
          ))}
        </select>
      </div>

      <RarityFilterRow rarities={ARTIFACT_RARITIES} rarityFilter={rarityFilter} onToggle={toggleRarity} />

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {filtered.length} set{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((set) => {
          const previewIcon = set.flowerIconUrl ?? set.featherIconUrl ?? set.circletIconUrl;
          return (
            <ArtifactCard
              key={set.id}
              setName={set.name}
              rarity={set.rarity}
              iconUrl={previewIcon}
              onSelect={() => setAddingSetId(set.id)}
              tooltipContent={
                <>
                  <p className="text-base font-semibold text-yellow-100">{set.name}</p>
                  <p className="mt-2 text-gray-300">
                    <span className="font-semibold text-yellow-100">2pc: </span>
                    {set.twoPieceEffect}
                  </p>
                  {set.fourPieceEffect && (
                    <p className="mt-2 text-gray-300">
                      <span className="font-semibold text-yellow-100">4pc: </span>
                      {set.fourPieceEffect}
                    </p>
                  )}
                </>
              }
            />
          );
        })}
        {filtered.length === 0 && <p className="col-span-full text-sm text-gray-500">No sets match this search.</p>}
      </ul>

      <Modal
        open={addingSet !== null}
        onClose={closeAddForm}
        maxWidthClassName="max-w-4xl"
        fitContent
        closeButtonClassName="text-white hover:bg-white/10"
      >
        {addingSet && (
          <ArtifactProgressionForm
            key={addingSet.id}
            set={addingSet}
            getSlotImageUrl={(slot) => slotIconUrl(addingSet, slot)}
            statTypes={statTypes}
            initialSlot={ArtifactSlot.Flower}
            slotFixed={false}
            initialLevel={maxLevelForRarity(addingSet.rarity)}
            initialMainStatId={statTypeByName.get(SLOT_MAIN_STATS[ArtifactSlot.Flower][0])?.id ?? 0}
            initialSubstats={[]}
            formBackgroundClassName="bg-secondary-page"
            submitLabel="Save artifact"
            onSubmit={(input) => handleAddSubmit(addingSet, input)}
          />
        )}
      </Modal>

      <Toast message={message} visible={visible} />
    </div>
  );
}
