"use client";

import { useRef, useState, useTransition } from "react";
import { WeaponType } from "@/generated/prisma/enums";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { WeaponTypeFilterRow } from "../weapon-type-filter-row";
import { WeaponCard } from "../weapon-card";
import { addWeapon } from "../actions";
import { filterAndSortWeaponCatalog, type WeaponCatalogItem, type CatalogSortKey } from "../filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function WeaponCatalog({ catalog }: { catalog: WeaponCatalogItem[] }) {
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<{ name: string; refinement: number } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeouts = useRef<{ hide?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> }>({});

  const [search, setSearch] = useState("");
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<CatalogSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [refinements, setRefinements] = useState<Record<number, number>>({});

  const filtered = filterAndSortWeaponCatalog(catalog, {
    search,
    weaponTypeFilter,
    rarityFilter,
    sortKey,
    sortDirection,
  });

  function showToast(name: string, refinement: number) {
    // Clear any in-flight hide/unmount timers from a previous toast so
    // rapid adds just reset the countdown instead of a stale timeout
    // cutting the new toast's animation short.
    clearTimeout(toastTimeouts.current.hide);
    clearTimeout(toastTimeouts.current.clear);

    setToast({ name, refinement });
    // Mount in the hidden state first, then flip to visible on the next
    // frame so the opacity/translate transition actually has something to
    // animate from, instead of just appearing already-visible.
    requestAnimationFrame(() => setToastVisible(true));

    toastTimeouts.current.hide = setTimeout(() => {
      setToastVisible(false);
      toastTimeouts.current.clear = setTimeout(() => setToast(null), 300);
    }, 2000);
  }

  function handleAdd(weaponId: number) {
    const refinement = refinements[weaponId] ?? 1;
    const weapon = catalog.find((w) => w.id === weaponId);

    startTransition(async () => {
      try {
        await addWeapon(weaponId, refinement);
        // Weapons can be added more than once (each is its own physical
        // copy), so the button itself never disables -- the same weapon
        // stays addable. A brief toast confirms the add instead.
        showToast(weapon?.name ?? "weapon", refinement);
      } catch {
        // Nothing changed, nothing to revert.
      }
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
          onChange={(event) => setSortKey(event.target.value as CatalogSortKey)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
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

      <p className="text-sm text-gray-500">
        {filtered.length} weapon{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((weapon) => (
          <WeaponCard
            key={weapon.id}
            name={weapon.name}
            weaponType={weapon.weaponType}
            rarity={weapon.rarity}
            secondaryStatName={weapon.secondaryStatName}
            iconUrl={weapon.iconUrl}
            refinement={refinements[weapon.id] ?? 1}
            onRefinementChange={(refinement) =>
              setRefinements((prev) => ({ ...prev, [weapon.id]: refinement }))
            }
            actionLabel="Add"
            onAction={() => handleAdd(weapon.id)}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No weapons match these filters.</p>}
      </ul>

      {toast && (
        // left-48 matches the sidebar's own w-48, so this centers within the
        // page content area rather than the full viewport (which would skew
        // the toast off-center behind the sidebar).
        <div className="fixed left-48 right-0 top-4 z-50 flex justify-center">
          <div
            className={`rounded-full border-2 border-emerald-300 bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg transition-all duration-300 ${
              toastVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
          >
            Added <span className="font-bold">{toast.name}</span> · R{toast.refinement}
          </div>
        </div>
      )}
    </div>
  );
}
