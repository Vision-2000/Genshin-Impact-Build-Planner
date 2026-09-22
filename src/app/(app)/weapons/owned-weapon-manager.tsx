"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { useDialogs } from "@/components/dialog-provider";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { MIN_LEVEL, MAX_LEVEL, validAscensionPhasesForLevel } from "@/lib/ascension";
import type { SortDirection } from "@/lib/sort";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { WeaponCard } from "./weapon-card";
import { removeWeapon, updateWeaponRefinement, updateWeaponProgression } from "./actions";
import { filterAndSortOwnedWeapons, type OwnedWeaponItem, type OwnedSortKey } from "./filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Modal body for editing level/ascension. A dropdown alone can't handle
// refinement (see WeaponCard's inline <select>), but level+ascension need
// even more room than that -- ascension is constrained by level (only one
// or two valid phases, see src/lib/ascension.ts), so changing the level
// slider snaps ascension to the closest still-valid phase, same idea as the
// artifact editor snapping substat values when level changes.
function WeaponProgressionEditor({
  weapon,
  onSave,
}: {
  weapon: OwnedWeaponItem;
  onSave: (level: number, ascensionPhase: number) => void;
}) {
  const [level, setLevel] = useState(weapon.level);
  const [ascensionPhase, setAscensionPhase] = useState(weapon.ascensionPhase);
  const validPhases = validAscensionPhasesForLevel(level);
  const maxValidPhase = Math.max(...validPhases);

  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    const phases = validAscensionPhasesForLevel(newLevel);
    if (!phases.includes(ascensionPhase)) {
      setAscensionPhase(phases[phases.length - 1]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg p-1.5 ${rarityGradientClasses(weapon.rarity)}`}
        >
          {weapon.iconUrl && <Image src={weapon.iconUrl} alt="" width={56} height={56} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{weapon.name}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Level
        <input
          type="range"
          min={MIN_LEVEL}
          max={MAX_LEVEL}
          value={level}
          onChange={(event) => handleLevelChange(Number(event.target.value))}
          className="-mt-1 w-32"
        />
        <span className="w-8 text-gray-400">{level}</span>
      </label>

      {validPhases.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          Ascension:
          <select
            value={ascensionPhase}
            onChange={(event) => setAscensionPhase(Number(event.target.value))}
            className="h-8 rounded border bg-white px-2 text-sm text-black"
          >
            {validPhases.map((phase) => (
              <option key={phase} value={phase}>
                Phase {phase} {phase === maxValidPhase ? "(ascended)" : "(pre-ascension)"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-gray-500">Ascension: Phase {ascensionPhase}</p>
      )}

      <div className="flex justify-end border-t pt-3">
        <button
          type="button"
          onClick={() => onSave(level, ascensionPhase)}
          className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function OwnedWeaponManager({ initialOwnedWeapons }: { initialOwnedWeapons: OwnedWeaponItem[] }) {
  useRefreshOnBackNavigation();
  const [owned, setOwned] = useState(initialOwnedWeapons);
  // useState(initialOwnedWeapons) only ever consults that argument on the
  // very first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialOwnedWeapons, setPrevInitialOwnedWeapons] = useState(initialOwnedWeapons);
  if (initialOwnedWeapons !== prevInitialOwnedWeapons) {
    setPrevInitialOwnedWeapons(initialOwnedWeapons);
    setOwned(initialOwnedWeapons);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const [search, setSearch] = useState("");
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = filterAndSortOwnedWeapons(owned, {
    search,
    weaponTypeFilter,
    rarityFilter,
    sortKey,
    sortDirection,
  });
  const editingWeapon = editingId === null ? null : (owned.find((w) => w.id === editingId) ?? null);

  function handleUpdateRefinement(ownedWeaponId: number, refinement: number) {
    const previous = owned;
    setOwned((prev) => prev.map((weapon) => (weapon.id === ownedWeaponId ? { ...weapon, refinement } : weapon)));

    startTransition(() => {
      updateWeaponRefinement(ownedWeaponId, refinement).catch(() => setOwned(previous));
    });
  }

  function handleUpdateProgression(ownedWeaponId: number, level: number, ascensionPhase: number) {
    const previous = owned;
    setOwned((prev) =>
      prev.map((weapon) => (weapon.id === ownedWeaponId ? { ...weapon, level, ascensionPhase } : weapon))
    );
    setEditingId(null);

    startTransition(async () => {
      const result = await updateWeaponProgression(ownedWeaponId, { level, ascensionPhase }).catch(
        () => ({ errors: {} }) as const
      );
      if ("errors" in result) setOwned(previous);
    });
  }

  async function handleRemove(ownedWeaponId: number) {
    const confirmed = await confirm("Remove this weapon? This can't be undone.", {
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;

    startTransition(() => {
      const previous = owned;
      setOwned((prev) => prev.filter((weapon) => weapon.id !== ownedWeaponId));
      removeWeapon(ownedWeaponId).catch(() => setOwned(previous));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as OwnedSortKey)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
          <option value="refinement">Sort: Refinement</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
      </div>

      <WeaponTypeFilterRow
        weaponTypeFilter={weaponTypeFilter}
        onToggle={(weaponType) => setWeaponTypeFilter((prev) => toggleInSet(prev, weaponType))}
      />
      <RarityFilterRow
        rarities={RARITIES}
        rarityFilter={rarityFilter}
        onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
      />

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {filtered.length} weapon{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((weapon) => (
          <WeaponCard
            key={weapon.id}
            name={weapon.name}
            weaponType={weapon.weaponType}
            rarity={weapon.rarity}
            secondaryStatName={weapon.secondaryStatName}
            iconUrl={weapon.iconUrl}
            refinement={weapon.refinement}
            onRefinementChange={(refinement) => handleUpdateRefinement(weapon.id, refinement)}
            actionLabel="Remove"
            onAction={() => handleRemove(weapon.id)}
            danger
            level={weapon.level}
            onEdit={() => setEditingId(weapon.id)}
            isActive={weapon.id === editingId}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No weapons match these filters.</p>}
      </ul>

      <Modal open={editingWeapon !== null} onClose={() => setEditingId(null)}>
        {editingWeapon && (
          <WeaponProgressionEditor
            key={editingWeapon.id}
            weapon={editingWeapon}
            onSave={(level, ascensionPhase) => handleUpdateProgression(editingWeapon.id, level, ascensionPhase)}
          />
        )}
      </Modal>
    </div>
  );
}
