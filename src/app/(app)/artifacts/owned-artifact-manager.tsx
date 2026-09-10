"use client";

import { Fragment, useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { paginate } from "@/lib/paginate";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { useDialogs } from "@/components/dialog-provider";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls } from "../pagination-controls";
import { addSubstat, removeArtifact, removeSubstat, updateArtifactLevel, updateSubstatValue } from "./actions";
import { ArtifactSlotFilterRow } from "./artifact-slot-filter-row";
import {
  ARTIFACT_RARITIES,
  MAIN_STAT_NAMES,
  MIN_LEVEL,
  MAX_SUBSTATS,
  SUBSTAT_TYPE_NAMES,
  maxLevelForRarity,
  type SubstatTypeName,
} from "./artifact-rules";
import {
  filterAndSortOwnedArtifacts,
  type OwnedArtifactItem,
  type OwnedArtifactSubstatItem,
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

// Compact grid card, same rarity-gradient-square treatment as Characters and
// Weapons, except the square only holds the icon -- main stat and substats
// are what most people actually recognize a piece by, so they're always
// shown as a plain-text block below it rather than hidden behind a click.
// Clicking the card still expands OwnedArtifactDetails as a full-width panel
// (via CSS Grid's column-span-full, not a modal -- see CLAUDE.md's reasoning
// against a second modal system for the add-artifact form; same call here),
// but that's now purely for editing level/substats, not for viewing them.
function OwnedArtifactCard({
  artifact,
  isExpanded,
  onToggleExpand,
}: {
  artifact: OwnedArtifactItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggleExpand}
        aria-pressed={isExpanded}
        aria-expanded={isExpanded}
        className={`@container block w-full overflow-hidden rounded-xl border-8 text-left shadow ${
          isExpanded ? "border-blue-500" : "border-gray-600"
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

          <span className="absolute right-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow">
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
      </button>
    </li>
  );
}

// The expanded editing panel -- spans every column of the grid (CSS Grid
// places the next item on a fresh row after a full-span item, no JS
// reordering needed), so it gets the same amount of room the old row-based
// layout gave it instead of squeezing into the card above.
function OwnedArtifactDetails({
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
  const maxLevel = maxLevelForRarity(artifact.rarity);
  const levels = Array.from({ length: maxLevel - MIN_LEVEL + 1 }, (_, i) => MIN_LEVEL + i);

  return (
    <li className="col-span-full space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg p-1.5 ${rarityGradientClasses(artifact.rarity)}`}
        >
          {artifact.iconUrl && <Image src={artifact.iconUrl} alt="" width={56} height={56} />}
        </div>
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
          {levels.map((level) => (
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

  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState<Set<ArtifactSlot>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [substatFilter, setSubstatFilter] = useState<Set<SubstatTypeName>>(new Set());
  const [mainStatFilter, setMainStatFilter] = useState("");
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    setExpandedId((current) => (current === ownedArtifactId ? null : current));
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
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
          className="rounded border bg-white px-2 py-1 text-sm text-black"
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
          className="rounded border bg-white px-2 py-1 text-sm text-black"
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
        {pageItems.map((artifact) => {
          const isExpanded = expandedId === artifact.id;
          return (
            <Fragment key={artifact.id}>
              <OwnedArtifactCard
                artifact={artifact}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedId((current) => (current === artifact.id ? null : artifact.id))}
              />
              {isExpanded && (
                <OwnedArtifactDetails
                  artifact={artifact}
                  statTypes={statTypes}
                  onUpdateLevel={(level) => handleUpdateLevel(artifact.id, level)}
                  onRemoveArtifact={() => handleRemoveArtifact(artifact.id)}
                  onUpdateSubstatValue={(substatId, value) => handleUpdateSubstatValue(artifact.id, substatId, value)}
                  onRemoveSubstat={(substatId) => handleRemoveSubstat(artifact.id, substatId)}
                  onAddSubstat={(statTypeId) => handleAddSubstatToOwned(artifact.id, statTypeId)}
                />
              )}
            </Fragment>
          );
        })}
        {pageItems.length === 0 && <p className="col-span-full text-sm text-gray-500">No artifacts match these filters.</p>}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
