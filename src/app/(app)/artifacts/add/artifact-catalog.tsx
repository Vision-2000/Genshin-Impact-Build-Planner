"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { useToast, Toast } from "@/components/toast";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { addArtifact } from "../actions";
import {
  MAX_SUBSTATS,
  MIN_LEVEL,
  MAX_LEVEL,
  SLOT_MAIN_STATS,
  SUBSTAT_TYPE_NAMES,
  maxLevelForRarity,
  substatValidValues,
  nearestValidValue,
  type SubstatTypeName,
} from "../artifact-rules";
import {
  filterArtifactSetCatalog,
  slotIconUrl,
  type ArtifactSetCatalogItem,
  type StatTypeOption,
} from "../filter-sort";

const SLOTS = Object.values(ArtifactSlot);
// Artifact sets are seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

type DraftSubstat = { statTypeId: number; value: number };

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
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const filtered = filterArtifactSetCatalog(catalog, { search, rarityFilter });

  function toggleRarity(rarity: number) {
    setRarityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
  }

  const [addingSetId, setAddingSetId] = useState<number | null>(null);
  const [addSlot, setAddSlot] = useState<ArtifactSlot>(ArtifactSlot.Flower);
  const [addLevel, setAddLevel] = useState(MAX_LEVEL);
  const [addMainStatId, setAddMainStatId] = useState<number | null>(null);
  const [addSubstats, setAddSubstats] = useState<DraftSubstat[]>([]);

  function openAddForm(setId: number) {
    const set = catalog.find((s) => s.id === setId);
    const initialMainStatId = statTypeByName.get(SLOT_MAIN_STATS[ArtifactSlot.Flower][0])?.id ?? null;
    setAddingSetId(setId);
    setAddSlot(ArtifactSlot.Flower);
    setAddLevel(set ? maxLevelForRarity(set.rarity) : MAX_LEVEL);
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

  // New substats and level changes both default/reset to the best achievable
  // value -- "assume the best case," matching the level slider's own +20
  // default.
  function addSubstatRow(rarity: number) {
    if (addSubstats.length >= MAX_SUBSTATS) return;
    const options = substatOptionsExcluding(-1);
    if (options.length === 0) return;
    const values = substatValidValues(options[0].name as SubstatTypeName, rarity, addLevel);
    setAddSubstats((prev) => [...prev, { statTypeId: options[0].id, value: values[values.length - 1] }]);
  }

  function removeSubstatRow(index: number) {
    setAddSubstats((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSubstatRow(index: number, changes: Partial<DraftSubstat>) {
    setAddSubstats((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  }

  // Changing which stat a row uses resets its value -- a value on the old
  // stat's scale has no relation to the new one's.
  function handleSubstatTypeChange(index: number, statTypeId: number, rarity: number) {
    const name = statTypeById.get(statTypeId)?.name as SubstatTypeName | undefined;
    const values = name ? substatValidValues(name, rarity, addLevel) : [0];
    updateSubstatRow(index, { statTypeId, value: values[values.length - 1] });
  }

  // Changing level can change which values are achievable for every existing
  // substat, so each one snaps to the closest value still valid at the new
  // level.
  function handleLevelChange(newLevel: number, rarity: number) {
    setAddLevel(newLevel);
    setAddSubstats((prev) =>
      prev.map((s) => {
        const name = statTypeById.get(s.statTypeId)?.name as SubstatTypeName | undefined;
        if (!name) return s;
        const values = substatValidValues(name, rarity, newLevel);
        return { ...s, value: nearestValidValue(values, s.value) };
      })
    );
  }

  function handleAddSubmit() {
    if (addingSetId === null || addMainStatId === null) return;

    const setId = addingSetId;
    const set = catalog.find((s) => s.id === setId);
    const setName = set?.name ?? "artifact";
    const rarity = set?.rarity ?? 0;
    const slot = addSlot;
    const level = addLevel;
    const mainStatId = addMainStatId;
    const substats = addSubstats.map((s) => ({ statTypeId: s.statTypeId, value: s.value }));

    startTransition(async () => {
      try {
        await addArtifact(setId, slot, level, mainStatId, substats);
        // Deliberately not calling closeAddForm() -- keeping the form's
        // values in place lets the user save a duplicate/near-duplicate
        // piece without re-entering everything.
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

      <RarityFilterRow rarities={RARITIES} rarityFilter={rarityFilter} onToggle={toggleRarity} />

      <p className="text-sm text-gray-500">
        {filtered.length} set{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="space-y-2">
        {filtered.map((set) => {
          const isAdding = addingSetId === set.id;
          const previewIcon = set.flowerIconUrl ?? set.featherIconUrl ?? set.circletIconUrl;

          function toggleExpanded() {
            if (isAdding) closeAddForm();
            else openAddForm(set.id);
          }

          return (
            <li key={set.id} className="rounded border p-3">
              <div
                role="button"
                tabIndex={0}
                onClick={toggleExpanded}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  toggleExpanded();
                }}
                className="flex cursor-pointer items-center gap-3"
              >
                {previewIcon && <Image src={previewIcon} alt="" width={40} height={40} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{set.name}</p>
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white ${rarityGradientClasses(set.rarity)}`}
                  >
                    {set.rarity}★
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-base font-semibold"
                >
                  {isAdding ? "−" : "+"}
                </span>
              </div>

              {isAdding && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Slot</p>
                    <div className="flex flex-wrap gap-2">
                      {SLOTS.map((slot) => {
                        const icon = slotIconUrl(set, slot);
                        const isSelected = addSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => handleSlotChange(slot)}
                            aria-pressed={isSelected}
                            className={`flex w-16 flex-col items-center gap-1 rounded-lg border-4 p-1.5 ${
                              isSelected ? "border-blue-500" : "border-transparent"
                            } ${rarityGradientClasses(set.rarity)}`}
                          >
                            {icon && <Image src={icon} alt="" width={40} height={40} />}
                            <span className="text-[10px] font-medium text-white">{slot}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1 text-xs">
                      Rarity
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium text-white ${rarityGradientClasses(set.rarity)}`}
                      >
                        {set.rarity}★
                      </span>
                      <span className="text-gray-500">(fixed by set)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs">
                      Level
                      <input
                        type="range"
                        min={MIN_LEVEL}
                        max={maxLevelForRarity(set.rarity)}
                        value={addLevel}
                        onChange={(event) => handleLevelChange(Number(event.target.value), set.rarity)}
                        className="w-32"
                      />
                      <span className="w-8 text-gray-500">+{addLevel}</span>
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium">Substats</p>
                      {addSubstats.length < MAX_SUBSTATS && (
                        <button
                          type="button"
                          onClick={() => addSubstatRow(set.rarity)}
                          title="Add substat"
                          className="flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold hover:bg-black/5"
                        >
                          +
                        </button>
                      )}
                    </div>
                    {addSubstats.map((substat, index) => {
                      const statName = statTypeById.get(substat.statTypeId)?.name as SubstatTypeName | undefined;
                      const values = statName ? substatValidValues(statName, set.rarity, addLevel) : [0];
                      // The slider steps through indices into `values` rather
                      // than the values themselves, since they aren't evenly
                      // spaced (only specific roll-combination sums are ever
                      // achievable).
                      const currentIndex = values.indexOf(nearestValidValue(values, substat.value));

                      return (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <select
                            value={substat.statTypeId}
                            onChange={(event) =>
                              handleSubstatTypeChange(index, Number(event.target.value), set.rarity)
                            }
                            className="w-44 shrink-0 rounded border bg-white px-2 py-1 text-xs text-black"
                          >
                            {substatOptionsExcluding(index).map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                            {!substatOptionsExcluding(index).some((o) => o.id === substat.statTypeId) &&
                              statTypeById.get(substat.statTypeId) && (
                                <option value={substat.statTypeId}>
                                  {statTypeById.get(substat.statTypeId)?.name}
                                </option>
                              )}
                          </select>
                          <input
                            type="range"
                            min={0}
                            max={values.length - 1}
                            step={1}
                            value={currentIndex}
                            onChange={(event) => updateSubstatRow(index, { value: values[Number(event.target.value)] })}
                            className="w-28"
                          />
                          <span className="w-14 text-xs text-gray-500">
                            {/* Flat stats (HP/ATK/DEF/Elemental Mastery) display as whole
                                numbers in-game; every %-based stat shows 1 decimal. */}
                            {values[currentIndex].toFixed(statName?.endsWith("%") ? 1 : 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSubstatRow(index)}
                            className="text-xs text-red-600 underline"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
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
