"use client";

import { useState, useTransition } from "react";
import { WeaponType } from "@/generated/prisma/enums";
import { useDialogs } from "@/components/dialog-provider";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import type { SortDirection } from "@/lib/sort";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { WeaponCard } from "./weapon-card";
import { removeWeapon, updateWeaponProgression } from "./actions";
import type { UpdateWeaponProgressionInput } from "./schemas";
import { WeaponProgressionForm } from "./weapon-progression-form";
import {
  filterAndSortOwnedWeapons,
  WEAPON_SECONDARY_STAT_NAMES,
  type OwnedWeaponItem,
  type OwnedSortKey,
} from "./filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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
  const [secondaryStatFilter, setSecondaryStatFilter] = useState("");
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = filterAndSortOwnedWeapons(owned, {
    search,
    weaponTypeFilter,
    rarityFilter,
    secondaryStatFilter,
    sortKey,
    sortDirection,
  });
  const editingWeapon = editingId === null ? null : (owned.find((w) => w.id === editingId) ?? null);

  function handleUpdateProgression(ownedWeaponId: number, input: UpdateWeaponProgressionInput) {
    const previous = owned;
    setOwned((prev) => prev.map((weapon) => (weapon.id === ownedWeaponId ? { ...weapon, ...input } : weapon)));
    setEditingId(null);

    startTransition(async () => {
      const result = await updateWeaponProgression(ownedWeaponId, input).catch(() => ({ errors: {} }) as const);
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
        <select
          value={secondaryStatFilter}
          onChange={(event) => setSecondaryStatFilter(event.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="">Weapon stat: Any</option>
          {WEAPON_SECONDARY_STAT_NAMES.map((name) => (
            <option key={name} value={name}>
              Weapon stat: {name}
            </option>
          ))}
        </select>
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

      <Modal
        open={editingWeapon !== null}
        onClose={() => setEditingId(null)}
        maxWidthClassName="max-w-3xl"
        fitContent
        closeButtonClassName="text-white hover:bg-white/10"
      >
        {editingWeapon && (
          <WeaponProgressionForm
            key={editingWeapon.id}
            weaponId={editingWeapon.weaponId}
            name={editingWeapon.name}
            weaponType={editingWeapon.weaponType}
            rarity={editingWeapon.rarity}
            iconUrl={editingWeapon.iconUrl}
            secondaryStatName={editingWeapon.secondaryStatName}
            initialLevel={editingWeapon.level}
            initialAscensionPhase={editingWeapon.ascensionPhase}
            initialRefinement={editingWeapon.refinement}
            submitLabel="Save"
            onSubmit={(input) => handleUpdateProgression(editingWeapon.id, input)}
          />
        )}
      </Modal>
    </div>
  );
}
