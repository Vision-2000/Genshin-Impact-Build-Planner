"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { useDialogs } from "@/components/dialog-provider";
import { PaginationControls } from "../pagination-controls";
import {
  addArtifact,
  addSubstat,
  removeArtifact,
  removeSubstat,
  updateArtifactLevel,
  updateSubstatValue,
} from "./actions";
import {
  MAX_SUBSTATS,
  MIN_LEVEL,
  MAX_LEVEL,
  SLOT_MAIN_STATS,
  SUBSTAT_TYPE_NAMES,
  type SubstatTypeName,
} from "./artifact-rules";
import {
  filterAndSortOwnedArtifacts,
  filterArtifactSetCatalog,
  type ArtifactSetCatalogItem,
  type OwnedArtifactItem,
  type OwnedArtifactSubstatItem,
  type OwnedSortKey,
  type StatTypeOption,
} from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const RARITIES = [5, 4, 3, 2, 1];
const LEVELS = Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => MIN_LEVEL + i);
const PAGE_SIZE = 10;

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

type DraftSubstat = { statTypeId: number; value: string };

function SubstatValueInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  return (
    <input
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const parsed = Number(draft);
        if (!Number.isNaN(parsed)) onCommit(parsed);
      }}
      className="w-16 rounded border bg-white px-1 py-0.5 text-xs text-black"
    />
  );
}

function OwnedArtifactCard({
  artifact,
  statTypes,
  onUpdateLevel,
  onRemoveArtifact,
  onUpdateSubstatValue,
  onRemoveSubstat,
  onAddSubstat,
}: {
  artifact: OwnedArtifactItem;
  statTypes: StatTypeOption[];
  onUpdateLevel: (level: number) => void;
  onRemoveArtifact: () => void;
  onUpdateSubstatValue: (substatId: number, value: number) => void;
  onRemoveSubstat: (substatId: number) => void;
  onAddSubstat: (statTypeId: number) => void;
}) {
  const statTypeByName = new Map(statTypes.map((s) => [s.name, s]));
  const usedIds = new Set([artifact.mainStatId, ...artifact.substats.map((s) => s.statTypeId)]);
  const availableToAdd = SUBSTAT_TYPE_NAMES.map((name) => statTypeByName.get(name)).filter(
    (s): s is StatTypeOption => !!s && !usedIds.has(s.id)
  );

  return (
    <li className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        {artifact.iconUrl && <Image src={artifact.iconUrl} alt="" width={40} height={40} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{artifact.setName}</p>
          <p className="text-xs text-gray-500">
            {artifact.rarity}★ {artifact.slot} · Main: {artifact.mainStatName}
          </p>
        </div>
        <select
          value={artifact.level}
          onChange={(event) => onUpdateLevel(Number(event.target.value))}
          className="rounded border bg-white px-2 py-1 text-xs text-black"
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              +{level}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRemoveArtifact} className="text-xs text-red-600 underline">
          Remove
        </button>
      </div>

      <ul className="space-y-1 pl-2">
        {artifact.substats.map((substat: OwnedArtifactSubstatItem) => (
          <li key={substat.id} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0">{substat.statTypeName}</span>
            <SubstatValueInput value={substat.value} onCommit={(value) => onUpdateSubstatValue(substat.id, value)} />
            <button type="button" onClick={() => onRemoveSubstat(substat.id)} className="text-red-600 underline">
              ×
            </button>
          </li>
        ))}
        {artifact.substats.length < MAX_SUBSTATS && availableToAdd.length > 0 && (
          <li>
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) onAddSubstat(Number(event.target.value));
                event.target.value = "";
              }}
              className="rounded border bg-white px-2 py-1 text-xs text-black"
            >
              <option value="" disabled>
                + Add substat
              </option>
              {availableToAdd.map((statType) => (
                <option key={statType.id} value={statType.id}>
                  {statType.name}
                </option>
              ))}
            </select>
          </li>
        )}
      </ul>
    </li>
  );
}

export function ArtifactManager({
  catalog,
  statTypes,
  initialOwnedArtifacts,
}: {
  catalog: ArtifactSetCatalogItem[];
  statTypes: StatTypeOption[];
  initialOwnedArtifacts: OwnedArtifactItem[];
}) {
  const [owned, setOwned] = useState(initialOwnedArtifacts);
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const statTypeByName = new Map(statTypes.map((s) => [s.name, s]));
  const statTypeById = new Map(statTypes.map((s) => [s.id, s]));

  const [ownedSearch, setOwnedSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState<Set<ArtifactSlot>>(new Set());
  const [substatFilter, setSubstatFilter] = useState<Set<SubstatTypeName>>(new Set());
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [ownedPage, setOwnedPage] = useState(1);

  const filteredOwned = filterAndSortOwnedArtifacts(owned, {
    search: ownedSearch,
    slotFilter,
    substatFilter,
    sortKey,
  });
  const {
    pageItems: ownedPageItems,
    pageCount: ownedPageCount,
    currentPage: ownedCurrentPage,
  } = paginate(filteredOwned, ownedPage, PAGE_SIZE);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const filteredCatalog = filterArtifactSetCatalog(catalog, { search: catalogSearch });
  const {
    pageItems: catalogPageItems,
    pageCount: catalogPageCount,
    currentPage: catalogCurrentPage,
  } = paginate(filteredCatalog, catalogPage, PAGE_SIZE);

  const [addingSetId, setAddingSetId] = useState<number | null>(null);
  const [addSlot, setAddSlot] = useState<ArtifactSlot>(ArtifactSlot.Flower);
  const [addRarity, setAddRarity] = useState(5);
  const [addLevel, setAddLevel] = useState(0);
  const [addMainStatId, setAddMainStatId] = useState<number | null>(null);
  const [addSubstats, setAddSubstats] = useState<DraftSubstat[]>([]);

  function openAddForm(setId: number) {
    const initialMainStatId = statTypeByName.get(SLOT_MAIN_STATS[ArtifactSlot.Flower][0])?.id ?? null;
    setAddingSetId(setId);
    setAddSlot(ArtifactSlot.Flower);
    setAddRarity(5);
    setAddLevel(0);
    setAddMainStatId(initialMainStatId);
    setAddSubstats([]);
  }

  function closeAddForm() {
    setAddingSetId(null);
  }

  function handleSlotChange(slot: ArtifactSlot) {
    setAddSlot(slot);
    const validNames = SLOT_MAIN_STATS[slot];
    const currentName = addMainStatId ? statTypeById.get(addMainStatId)?.name : undefined;
    const nextMainStatId =
      currentName && validNames.includes(currentName) ? addMainStatId : statTypeByName.get(validNames[0])?.id ?? null;

    setAddMainStatId(nextMainStatId);
    setAddSubstats((prev) => prev.filter((s) => s.statTypeId !== nextMainStatId));
  }

  function handleMainStatChange(statTypeId: number) {
    setAddMainStatId(statTypeId);
    setAddSubstats((prev) => prev.filter((s) => s.statTypeId !== statTypeId));
  }

  function substatOptionsExcluding(excludeIndex: number): StatTypeOption[] {
    const used = new Set(addSubstats.filter((_, i) => i !== excludeIndex).map((s) => s.statTypeId));
    if (addMainStatId !== null) used.add(addMainStatId);
    return SUBSTAT_TYPE_NAMES.map((name) => statTypeByName.get(name)).filter(
      (s): s is StatTypeOption => !!s && !used.has(s.id)
    );
  }

  function addSubstatRow() {
    if (addSubstats.length >= MAX_SUBSTATS) return;
    const options = substatOptionsExcluding(-1);
    if (options.length === 0) return;
    setAddSubstats((prev) => [...prev, { statTypeId: options[0].id, value: "" }]);
  }

  function removeSubstatRow(index: number) {
    setAddSubstats((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSubstatRow(index: number, changes: Partial<DraftSubstat>) {
    setAddSubstats((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  }

  function handleAddSubmit() {
    if (addingSetId === null || addMainStatId === null) return;

    const setId = addingSetId;
    const slot = addSlot;
    const rarity = addRarity;
    const level = addLevel;
    const mainStatId = addMainStatId;
    const substats = addSubstats
      .filter((s) => s.value.trim() !== "")
      .map((s) => ({ statTypeId: s.statTypeId, value: Number(s.value) }));

    startTransition(async () => {
      try {
        const created = await addArtifact(setId, slot, rarity, level, mainStatId, substats);
        setOwned((prev) => [...prev, created]);
        closeAddForm();
      } catch {
        // Nothing was added to local state yet, so there's nothing to revert.
      }
    });
  }

  function handleUpdateLevel(ownedArtifactId: number, level: number) {
    const previous = owned;
    setOwned((prev) => prev.map((a) => (a.id === ownedArtifactId ? { ...a, level } : a)));
    startTransition(() => {
      updateArtifactLevel(ownedArtifactId, level).catch(() => setOwned(previous));
    });
  }

  async function handleRemoveArtifact(ownedArtifactId: number) {
    const confirmed = await confirm("Remove this artifact? This can't be undone.", {
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(() => {
      const previous = owned;
      setOwned((prev) => prev.filter((a) => a.id !== ownedArtifactId));
      removeArtifact(ownedArtifactId).catch(() => setOwned(previous));
    });
  }

  function handleUpdateSubstatValue(ownedArtifactId: number, substatId: number, value: number) {
    const previous = owned;
    setOwned((prev) =>
      prev.map((a) =>
        a.id === ownedArtifactId
          ? { ...a, substats: a.substats.map((s) => (s.id === substatId ? { ...s, value } : s)) }
          : a
      )
    );
    startTransition(() => {
      updateSubstatValue(substatId, value).catch(() => setOwned(previous));
    });
  }

  function handleRemoveSubstat(ownedArtifactId: number, substatId: number) {
    const previous = owned;
    setOwned((prev) =>
      prev.map((a) =>
        a.id === ownedArtifactId ? { ...a, substats: a.substats.filter((s) => s.id !== substatId) } : a
      )
    );
    startTransition(() => {
      removeSubstat(substatId).catch(() => setOwned(previous));
    });
  }

  function handleAddSubstatToOwned(ownedArtifactId: number, statTypeId: number) {
    startTransition(async () => {
      const created = await addSubstat(ownedArtifactId, statTypeId, 0);
      if (created) {
        setOwned((prev) =>
          prev.map((a) => (a.id === ownedArtifactId ? { ...a, substats: [...a.substats, created] } : a))
        );
      }
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your artifacts</h2>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by set name..."
            value={ownedSearch}
            onChange={(event) => {
              setOwnedSearch(event.target.value);
              setOwnedPage(1);
            }}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as OwnedSortKey)}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          >
            <option value="name">Sort: Name</option>
            <option value="rarity">Sort: Rarity</option>
            <option value="level">Sort: Level</option>
            {SUBSTAT_TYPE_NAMES.map((name) => (
              <option key={name} value={name}>
                Sort: Highest {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => {
                setSlotFilter((prev) => toggleInSet(prev, slot));
                setOwnedPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                slotFilter.has(slot) ? "bg-foreground text-background" : ""
              }`}
            >
              {slot}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {SUBSTAT_TYPE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSubstatFilter((prev) => toggleInSet(prev, name));
                setOwnedPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                substatFilter.has(name) ? "bg-foreground text-background" : ""
              }`}
            >
              Has {name}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500">
          {filteredOwned.length} artifact{filteredOwned.length === 1 ? "" : "s"}
        </p>

        <ul className="space-y-2">
          {ownedPageItems.map((artifact) => (
            <OwnedArtifactCard
              key={artifact.id}
              artifact={artifact}
              statTypes={statTypes}
              onUpdateLevel={(level) => handleUpdateLevel(artifact.id, level)}
              onRemoveArtifact={() => handleRemoveArtifact(artifact.id)}
              onUpdateSubstatValue={(substatId, value) => handleUpdateSubstatValue(artifact.id, substatId, value)}
              onRemoveSubstat={(substatId) => handleRemoveSubstat(artifact.id, substatId)}
              onAddSubstat={(statTypeId) => handleAddSubstatToOwned(artifact.id, statTypeId)}
            />
          ))}
          {ownedPageItems.length === 0 && (
            <p className="text-sm text-gray-500">No artifacts match these filters.</p>
          )}
        </ul>

        <PaginationControls currentPage={ownedCurrentPage} pageCount={ownedPageCount} onPageChange={setOwnedPage} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Add an artifact</h2>

        <input
          type="text"
          placeholder="Search by set name..."
          value={catalogSearch}
          onChange={(event) => {
            setCatalogSearch(event.target.value);
            setCatalogPage(1);
          }}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />

        <ul className="space-y-2">
          {catalogPageItems.map((set) => {
            const isAdding = addingSetId === set.id;
            const previewIcon = set.flowerIconUrl ?? set.featherIconUrl ?? set.circletIconUrl;

            return (
              <li key={set.id} className="rounded border p-3">
                <div className="flex items-center gap-3">
                  {previewIcon && <Image src={previewIcon} alt="" width={40} height={40} />}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{set.name}</p>
                  <button
                    type="button"
                    onClick={() => (isAdding ? closeAddForm() : openAddForm(set.id))}
                    className="rounded bg-black px-2 py-1 text-xs text-white"
                  >
                    {isAdding ? "Cancel" : "Add"}
                  </button>
                </div>

                {isAdding && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div className="flex flex-wrap gap-3">
                      <label className="text-xs">
                        Slot
                        <select
                          value={addSlot}
                          onChange={(event) => handleSlotChange(event.target.value as ArtifactSlot)}
                          className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                        >
                          {SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs">
                        Rarity
                        <select
                          value={addRarity}
                          onChange={(event) => setAddRarity(Number(event.target.value))}
                          className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                        >
                          {RARITIES.map((rarity) => (
                            <option key={rarity} value={rarity}>
                              {rarity}★
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs">
                        Level
                        <select
                          value={addLevel}
                          onChange={(event) => setAddLevel(Number(event.target.value))}
                          className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              +{level}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs">
                        Main stat
                        {SLOT_MAIN_STATS[addSlot].length === 1 ? (
                          <span className="ml-1 text-gray-500">{SLOT_MAIN_STATS[addSlot][0]} (fixed)</span>
                        ) : (
                          <select
                            value={addMainStatId ?? ""}
                            onChange={(event) => handleMainStatChange(Number(event.target.value))}
                            className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                          >
                            {SLOT_MAIN_STATS[addSlot].map((name) => {
                              const option = statTypeByName.get(name);
                              return option ? (
                                <option key={option.id} value={option.id}>
                                  {name}
                                </option>
                              ) : null;
                            })}
                          </select>
                        )}
                      </label>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium">Substats</p>
                      {addSubstats.map((substat, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <select
                            value={substat.statTypeId}
                            onChange={(event) => updateSubstatRow(index, { statTypeId: Number(event.target.value) })}
                            className="rounded border bg-white px-2 py-1 text-xs text-black"
                          >
                            {substatOptionsExcluding(index).map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                            {!substatOptionsExcluding(index).some((o) => o.id === substat.statTypeId) &&
                              statTypeById.get(substat.statTypeId) && (
                                <option value={substat.statTypeId}>{statTypeById.get(substat.statTypeId)?.name}</option>
                              )}
                          </select>
                          <input
                            type="number"
                            placeholder="Value"
                            value={substat.value}
                            onChange={(event) => updateSubstatRow(index, { value: event.target.value })}
                            className="w-20 rounded border bg-white px-2 py-1 text-xs text-black"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubstatRow(index)}
                            className="text-xs text-red-600 underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {addSubstats.length < MAX_SUBSTATS && (
                        <button type="button" onClick={addSubstatRow} className="text-xs underline">
                          + Add substat
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSubmit}
                      className="rounded bg-black px-3 py-1 text-xs text-white"
                    >
                      Save artifact
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {catalogPageItems.length === 0 && <p className="text-sm text-gray-500">No sets match this search.</p>}
        </ul>

        <PaginationControls
          currentPage={catalogCurrentPage}
          pageCount={catalogPageCount}
          onPageChange={setCatalogPage}
        />
      </section>
    </div>
  );
}
