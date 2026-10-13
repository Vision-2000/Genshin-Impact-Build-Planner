"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { rarityGradientClasses } from "@/lib/rarity-colors";
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
import {
  ARTIFACT_RARITIES,
  MAIN_STAT_NAMES,
  MIN_LEVEL,
  MAX_SUBSTATS,
  SLOT_MAIN_STATS,
  SUBSTAT_TYPE_NAMES,
  maxLevelForRarity,
  substatValidValues,
  nearestValidValue,
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

type DraftSubstat = { statTypeId: number | null; value: number };

// Modal body for editing one piece. Mirrors the add-artifact form: a level
// slider and up to MAX_SUBSTATS substat rows, each a stat-type dropdown ("None"
// to leave it empty) plus a slider that steps through only the values that
// stat can actually roll at this rarity and level. Changes are drafted locally
// and committed in one call on Save, same as the add flow.
function OwnedArtifactEditor({
  artifact,
  statTypes,
  onSave,
  onDelete,
}: {
  artifact: OwnedArtifactItem;
  statTypes: StatTypeOption[];
  onSave: (level: number, mainStatId: number, substats: { statTypeId: number; value: number }[]) => void;
  onDelete: () => void;
}) {
  const statTypeByName = new Map(statTypes.map((s) => [s.name, s]));
  const statTypeById = new Map(statTypes.map((s) => [s.id, s]));
  const rarity = artifact.rarity;
  const maxLevel = maxLevelForRarity(rarity);
  const mainStatNames = SLOT_MAIN_STATS[artifact.slot];

  const [level, setLevel] = useState(artifact.level);
  const [mainStatId, setMainStatId] = useState(artifact.mainStatId);
  const [substats, setSubstats] = useState<DraftSubstat[]>(() => {
    const rows: DraftSubstat[] = artifact.substats.map((s) => ({ statTypeId: s.statTypeId, value: s.value }));
    while (rows.length < MAX_SUBSTATS) rows.push({ statTypeId: null, value: 0 });
    return rows;
  });

  function substatOptionsExcluding(excludeIndex: number): StatTypeOption[] {
    const used = new Set(
      substats
        .filter((_, i) => i !== excludeIndex)
        .map((s) => s.statTypeId)
        .filter((id): id is number => id !== null)
    );
    used.add(mainStatId);
    return SUBSTAT_TYPE_NAMES.map((name) => statTypeByName.get(name)).filter(
      (s): s is StatTypeOption => !!s && !used.has(s.id)
    );
  }

  // A stat can't be both the main stat and a substat -- clear any row that
  // collides with the newly picked main stat.
  function handleMainStatChange(nextMainStatId: number) {
    setMainStatId(nextMainStatId);
    setSubstats((prev) =>
      prev.map((s) => (s.statTypeId === nextMainStatId ? { statTypeId: null, value: 0 } : s))
    );
  }

  function updateSubstatRow(index: number, changes: Partial<DraftSubstat>) {
    setSubstats((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  }

  // Selecting "None" clears the row; picking a stat defaults to its lowest
  // achievable value (the slider's leftmost position).
  function handleSubstatTypeChange(index: number, statTypeId: number | null) {
    if (statTypeId === null) {
      updateSubstatRow(index, { statTypeId: null, value: 0 });
      return;
    }
    const name = statTypeById.get(statTypeId)?.name as SubstatTypeName | undefined;
    const values = name ? substatValidValues(name, rarity, level) : [0];
    updateSubstatRow(index, { statTypeId, value: values[0] });
  }

  // Changing level shifts which values each substat can hold, so snap every
  // set substat to the closest value still valid at the new level.
  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    setSubstats((prev) =>
      prev.map((s) => {
        if (s.statTypeId === null) return s;
        const name = statTypeById.get(s.statTypeId)?.name as SubstatTypeName | undefined;
        if (!name) return s;
        const values = substatValidValues(name, rarity, newLevel);
        return { ...s, value: nearestValidValue(values, s.value) };
      })
    );
  }

  function handleSave() {
    const payload = substats
      .filter((s): s is { statTypeId: number; value: number } => s.statTypeId !== null)
      .map((s) => ({ statTypeId: s.statTypeId, value: s.value }));
    onSave(level, mainStatId, payload);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg p-1.5 ${rarityGradientClasses(rarity)}`}
        >
          {artifact.iconUrl && <Image src={artifact.iconUrl} alt="" width={56} height={56} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{artifact.setName}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Level
        <input
          type="range"
          min={MIN_LEVEL}
          max={maxLevel}
          value={level}
          onChange={(event) => handleLevelChange(Number(event.target.value))}
          className="-mt-1 w-32"
        />
        <span className="w-8 text-gray-400">+{level}</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        Main stat:
        <select
          value={mainStatId}
          onChange={(event) => handleMainStatChange(Number(event.target.value))}
          disabled={mainStatNames.length === 1}
          className="w-[11.5rem] rounded border bg-white h-8 px-2 text-sm text-black disabled:bg-gray-100 disabled:text-gray-500"
        >
          {mainStatNames.map((name) => {
            const option = statTypeByName.get(name);
            return option ? (
              <option key={option.id} value={option.id}>
                {name}
              </option>
            ) : null;
          })}
        </select>
      </label>

      <div className="space-y-1">
        <p className="text-sm font-medium">Substats</p>
        {substats.map((substat, index) => {
          const statName = statTypeById.get(substat.statTypeId ?? -1)?.name as SubstatTypeName | undefined;
          const values = statName ? substatValidValues(statName, rarity, level) : [0];
          const currentIndex = values.indexOf(nearestValidValue(values, substat.value));

          return (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={substat.statTypeId ?? ""}
                onChange={(event) =>
                  handleSubstatTypeChange(index, event.target.value === "" ? null : Number(event.target.value))
                }
                className="w-44 shrink-0 rounded border bg-white h-8 px-2 text-sm text-black"
              >
                <option value="">None</option>
                {substatOptionsExcluding(index).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
                {!substatOptionsExcluding(index).some((o) => o.id === substat.statTypeId) &&
                  statTypeById.get(substat.statTypeId ?? -1) && (
                    <option value={substat.statTypeId ?? ""}>
                      {statTypeById.get(substat.statTypeId ?? -1)?.name}
                    </option>
                  )}
              </select>
              {substat.statTypeId !== null && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={values.length - 1}
                    step={1}
                    value={currentIndex}
                    onChange={(event) => updateSubstatRow(index, { value: values[Number(event.target.value)] })}
                    className="w-28"
                  />
                  <span className="w-14 text-sm text-gray-400">
                    {formatStatValue(statName ?? "", values[currentIndex])}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white"
        >
          Delete artifact
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Save
        </button>
      </div>
    </div>
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
  // Held for the lifetime of the delete confirm dialog so the card stays
  // highlighted while the mouse is off it answering the prompt.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

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
  const activeId = editingId ?? pendingDeleteId;

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
    setPendingDeleteId(ownedArtifactId);
    const confirmed = await confirm("Remove this artifact? This can't be undone.", {
      confirmLabel: "Remove",
      danger: true,
    });
    setPendingDeleteId(null);
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

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pageItems.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            setName={artifact.setName}
            slot={artifact.slot}
            rarity={artifact.rarity}
            level={artifact.level}
            mainStatName={artifact.mainStatName}
            iconUrl={artifact.iconUrl}
            substats={artifact.substats}
            isActive={artifact.id === activeId}
            onEdit={() => setEditingId(artifact.id)}
            onDelete={() => handleRemoveArtifact(artifact.id)}
          />
        ))}
        {pageItems.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">No artifacts match these filters.</p>
        )}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />

      <Modal open={editingArtifact !== null} onClose={() => setEditingId(null)}>
        {editingArtifact && (
          <OwnedArtifactEditor
            key={editingArtifact.id}
            artifact={editingArtifact}
            statTypes={statTypes}
            onSave={(level, mainStatId, substats) =>
              handleSaveArtifact(editingArtifact.id, level, mainStatId, substats)
            }
            onDelete={() => handleRemoveArtifact(editingArtifact.id)}
          />
        )}
      </Modal>
    </div>
  );
}
