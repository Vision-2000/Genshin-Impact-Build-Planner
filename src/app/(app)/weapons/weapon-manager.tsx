"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { useDialogs } from "@/components/dialog-provider";
import { PaginationControls } from "../pagination-controls";
import { WeaponTypeFilterRow } from "./weapon-type-filter-row";
import { addWeapon, removeWeapon, updateWeaponRefinement } from "./actions";
import {
  filterAndSortWeaponCatalog,
  filterAndSortOwnedWeapons,
  type WeaponCatalogItem,
  type OwnedWeaponItem,
  type CatalogSortKey,
  type OwnedSortKey,
} from "./filter-sort";

const PAGE_SIZE = 12;
const REFINEMENTS = [1, 2, 3, 4, 5];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function WeaponManager({
  catalog,
  initialOwnedWeapons,
}: {
  catalog: WeaponCatalogItem[];
  initialOwnedWeapons: OwnedWeaponItem[];
}) {
  const [owned, setOwned] = useState(initialOwnedWeapons);
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const [ownedSearch, setOwnedSearch] = useState("");
  const [ownedTypeFilter, setOwnedTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [ownedSortKey, setOwnedSortKey] = useState<OwnedSortKey>("name");
  const [ownedPage, setOwnedPage] = useState(1);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [catalogSortKey, setCatalogSortKey] = useState<CatalogSortKey>("name");
  const [catalogPage, setCatalogPage] = useState(1);
  const [addRefinements, setAddRefinements] = useState<Record<number, number>>({});

  const filteredOwned = filterAndSortOwnedWeapons(owned, {
    search: ownedSearch,
    weaponTypeFilter: ownedTypeFilter,
    sortKey: ownedSortKey,
  });
  const {
    pageItems: ownedPageItems,
    pageCount: ownedPageCount,
    currentPage: ownedCurrentPage,
  } = paginate(filteredOwned, ownedPage, PAGE_SIZE);

  const filteredCatalog = filterAndSortWeaponCatalog(catalog, {
    search: catalogSearch,
    weaponTypeFilter: catalogTypeFilter,
    sortKey: catalogSortKey,
  });
  const {
    pageItems: catalogPageItems,
    pageCount: catalogPageCount,
    currentPage: catalogCurrentPage,
  } = paginate(filteredCatalog, catalogPage, PAGE_SIZE);

  function toggleOwnedType(weaponType: WeaponType) {
    setOwnedTypeFilter((prev) => toggleInSet(prev, weaponType));
    setOwnedPage(1);
  }

  function toggleCatalogType(weaponType: WeaponType) {
    setCatalogTypeFilter((prev) => toggleInSet(prev, weaponType));
    setCatalogPage(1);
  }

  function handleUpdateRefinement(ownedWeaponId: number, refinement: number) {
    const previous = owned;
    setOwned((prev) => prev.map((weapon) => (weapon.id === ownedWeaponId ? { ...weapon, refinement } : weapon)));

    startTransition(() => {
      updateWeaponRefinement(ownedWeaponId, refinement).catch(() => {
        setOwned(previous);
      });
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

      removeWeapon(ownedWeaponId).catch(() => {
        setOwned(previous);
      });
    });
  }

  function handleAdd(weaponId: number) {
    const refinement = addRefinements[weaponId] ?? 1;

    startTransition(async () => {
      try {
        const created = await addWeapon(weaponId, refinement);
        setOwned((prev) => [...prev, created]);
      } catch {
        // Nothing was added to local state yet, so there's nothing to revert.
      }
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your weapons</h2>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name..."
            value={ownedSearch}
            onChange={(event) => {
              setOwnedSearch(event.target.value);
              setOwnedPage(1);
            }}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <select
            value={ownedSortKey}
            onChange={(event) => setOwnedSortKey(event.target.value as OwnedSortKey)}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          >
            <option value="name">Sort: Name</option>
            <option value="rarity">Sort: Rarity</option>
            <option value="refinement">Sort: Refinement</option>
          </select>
        </div>

        <WeaponTypeFilterRow weaponTypeFilter={ownedTypeFilter} onToggle={toggleOwnedType} />

        <p className="text-sm text-gray-500">
          {filteredOwned.length} weapon{filteredOwned.length === 1 ? "" : "s"}
        </p>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {ownedPageItems.map((weapon) => (
            <li key={weapon.id} className="flex items-center gap-3 rounded border p-3">
              {weapon.iconUrl && <Image src={weapon.iconUrl} alt="" width={40} height={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{weapon.name}</p>
                <p className="text-xs text-gray-500">
                  {weapon.rarity}★ {weapon.weaponType}
                  {weapon.secondaryStatName ? ` · ${weapon.secondaryStatName}` : ""}
                </p>
              </div>
              <select
                value={weapon.refinement}
                onChange={(event) => handleUpdateRefinement(weapon.id, Number(event.target.value))}
                className="rounded border bg-white px-2 py-1 text-xs text-black"
              >
                {REFINEMENTS.map((refinement) => (
                  <option key={refinement} value={refinement}>
                    R{refinement}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleRemove(weapon.id)}
                className="text-xs text-red-600 underline"
              >
                Remove
              </button>
            </li>
          ))}
          {ownedPageItems.length === 0 && (
            <p className="text-sm text-gray-500">No weapons match these filters.</p>
          )}
        </ul>

        <PaginationControls currentPage={ownedCurrentPage} pageCount={ownedPageCount} onPageChange={setOwnedPage} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Add a weapon</h2>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name..."
            value={catalogSearch}
            onChange={(event) => {
              setCatalogSearch(event.target.value);
              setCatalogPage(1);
            }}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <select
            value={catalogSortKey}
            onChange={(event) => setCatalogSortKey(event.target.value as CatalogSortKey)}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          >
            <option value="name">Sort: Name</option>
            <option value="rarity">Sort: Rarity</option>
          </select>
        </div>

        <WeaponTypeFilterRow weaponTypeFilter={catalogTypeFilter} onToggle={toggleCatalogType} />

        <p className="text-sm text-gray-500">
          {filteredCatalog.length} weapon{filteredCatalog.length === 1 ? "" : "s"}
        </p>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {catalogPageItems.map((weapon) => (
            <li key={weapon.id} className="flex items-center gap-3 rounded border p-3">
              {weapon.iconUrl && <Image src={weapon.iconUrl} alt="" width={40} height={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{weapon.name}</p>
                <p className="text-xs text-gray-500">
                  {weapon.rarity}★ {weapon.weaponType}
                  {weapon.secondaryStatName ? ` · ${weapon.secondaryStatName}` : ""}
                </p>
              </div>
              <select
                value={addRefinements[weapon.id] ?? 1}
                onChange={(event) =>
                  setAddRefinements((prev) => ({ ...prev, [weapon.id]: Number(event.target.value) }))
                }
                className="rounded border bg-white px-2 py-1 text-xs text-black"
              >
                {REFINEMENTS.map((refinement) => (
                  <option key={refinement} value={refinement}>
                    R{refinement}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleAdd(weapon.id)}
                className="rounded bg-black px-2 py-1 text-xs text-white"
              >
                Add
              </button>
            </li>
          ))}
          {catalogPageItems.length === 0 && (
            <p className="text-sm text-gray-500">No weapons match these filters.</p>
          )}
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
