"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { useToast, Toast } from "@/components/toast";
import { addArtifact } from "../actions";
import { MAX_SUBSTATS, MIN_LEVEL, MAX_LEVEL, SLOT_MAIN_STATS, SUBSTAT_TYPE_NAMES } from "../artifact-rules";
import {
  filterArtifactSetCatalog,
  type ArtifactSetCatalogItem,
  type StatTypeOption,
} from "../filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const RARITIES = [5, 4, 3, 2, 1];
const LEVELS = Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => MIN_LEVEL + i);

type DraftSubstat = { statTypeId: number; value: string };

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
  const statTypeById = new Map(statTypes.map((s) => [s.id, s]));

  const [search, setSearch] = useState("");
  const filtered = filterArtifactSetCatalog(catalog, { search });

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
    const setName = catalog.find((s) => s.id === setId)?.name ?? "artifact";
    const slot = addSlot;
    const rarity = addRarity;
    const level = addLevel;
    const mainStatId = addMainStatId;
    const substats = addSubstats
      .filter((s) => s.value.trim() !== "")
      .map((s) => ({ statTypeId: s.statTypeId, value: Number(s.value) }));

    startTransition(async () => {
      try {
        await addArtifact(setId, slot, rarity, level, mainStatId, substats);
        closeAddForm();
        // No local owned list here -- owned artifacts live on their own page
        // (/artifacts) -- so a toast confirms the add instead.
        showToast(
          <>
            Added <span className="font-bold">{setName}</span> · {slot} · {rarity}★
          </>
        );
      } catch {
        // Nothing was added, nothing to revert.
      }
    });
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by set name..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="rounded border bg-white px-3 py-2 text-sm text-black"
      />

      <p className="text-sm text-gray-500">
        {filtered.length} set{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="space-y-2">
        {filtered.map((set) => {
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
                  className="rounded border px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
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
        {filtered.length === 0 && <p className="text-sm text-gray-500">No sets match this search.</p>}
      </ul>

      <Toast message={message} visible={visible} />
    </div>
  );
}
