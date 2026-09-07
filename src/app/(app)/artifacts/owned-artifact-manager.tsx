"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { useDialogs } from "@/components/dialog-provider";
import { PaginationControls } from "../pagination-controls";
import { addSubstat, removeArtifact, removeSubstat, updateArtifactLevel, updateSubstatValue } from "./actions";
import { MIN_LEVEL, MAX_LEVEL, MAX_SUBSTATS, SUBSTAT_TYPE_NAMES, type SubstatTypeName } from "./artifact-rules";
import {
  filterAndSortOwnedArtifacts,
  type OwnedArtifactItem,
  type OwnedArtifactSubstatItem,
  type OwnedSortKey,
  type StatTypeOption,
} from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const LEVELS = Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => MIN_LEVEL + i);
const PAGE_SIZE = 10;

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
  const [substatFilter, setSubstatFilter] = useState<Set<SubstatTypeName>>(new Set());
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [page, setPage] = useState(1);

  const filtered = filterAndSortOwnedArtifacts(owned, { search, slotFilter, substatFilter, sortKey });
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
              setPage(1);
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
              setPage(1);
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
        {filtered.length} artifact{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="space-y-2">
        {pageItems.map((artifact) => (
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
        {pageItems.length === 0 && <p className="text-sm text-gray-500">No artifacts match these filters.</p>}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
