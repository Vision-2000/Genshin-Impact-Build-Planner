"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { paginate } from "@/lib/paginate";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls } from "../pagination-controls";
import { removeArtifact, updateArtifact } from "./actions";
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

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 2.5l3 3L6 13l-3.5 1L4 10.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9.5h6.8L12 4" />
    </svg>
  );
}

// Display-only grid card, same rarity-gradient-square treatment as Characters
// and Weapons but with a plain-text block below the icon for the main stat and
// substats -- what people actually recognize a piece by. Viewing needs no
// interaction; the two actions (edit, delete) are small buttons revealed on
// hover/focus, since editing is rare and shouldn't be one stray click away.
function OwnedArtifactCard({
  artifact,
  isActive,
  onEdit,
  onDelete,
}: {
  artifact: OwnedArtifactItem;
  // The card whose edit modal / delete confirm is currently open. Its action
  // buttons stay put and it keeps a highlighted border, so once the mouse
  // leaves for the dialog it's still obvious which piece is being operated on.
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group relative">
      <div
        className={`@container w-full overflow-hidden rounded-xl border-8 shadow ${
          isActive ? "border-blue-500" : "border-gray-600"
        } ${rarityGradientClasses(artifact.rarity)}`}
      >
        <div className="relative aspect-[4/3] w-full">
          {artifact.iconUrl && (
            <Image
              src={artifact.iconUrl}
              alt=""
              fill
              sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
              className="object-contain p-4"
            />
          )}

          <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
            <Image src={ARTIFACT_SLOT_ICON_URL[artifact.slot]} alt={artifact.slot} width={26} height={26} />
          </span>

          <span
            className={`absolute right-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow transition-transform duration-200 group-hover:translate-y-6 group-focus-within:translate-y-6 ${
              isActive ? "translate-y-6" : ""
            }`}
          >
            <span className="mt-0.5 text-sm font-semibold leading-none text-white">+{artifact.level}</span>
          </span>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
            <p className="truncate text-center text-sm font-semibold text-white">{artifact.setName}</p>
          </div>
        </div>

        <div className="bg-background px-2 py-1.5">
          <p className="-mx-2 mb-2.5 truncate bg-foreground/10 px-2 pb-1 pt-1.5 text-xs text-foreground">
            <span className="text-gray-400">MAIN STAT:</span>{" "}
            <span className="font-semibold">{artifact.mainStatName}</span>
          </p>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400">Substats</p>
          <div className="grid min-h-[4.5rem] grid-cols-1 gap-x-2 gap-y-1 @[18rem]:min-h-[2.5rem] @[18rem]:grid-cols-2">
            {artifact.substats.map((substat) => (
              <p key={substat.id} className="truncate text-[11px] leading-tight text-foreground/75">
                {substat.statTypeName} +{substat.value.toFixed(substat.statTypeName.endsWith("%") ? 1 : 0)}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`absolute right-1.5 top-1.5 z-20 flex gap-1 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
          isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${artifact.setName}`}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-black"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${artifact.setName}`}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-red-600"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
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
                    {/* Flat stats (HP/ATK/DEF/Elemental Mastery) display as whole
                        numbers in-game; every %-based stat shows 1 decimal. */}
                    {values[currentIndex].toFixed(statName?.endsWith("%") ? 1 : 0)}
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
  const [owned, setOwned] = useState(initialOwnedArtifacts);
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

      <p className="text-sm text-gray-500">
        {filtered.length} artifact{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pageItems.map((artifact) => (
          <OwnedArtifactCard
            key={artifact.id}
            artifact={artifact}
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
