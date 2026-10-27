"use client";

import { useState, useTransition } from "react";
import { WeaponType } from "@/generated/prisma/enums";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { useToast, Toast } from "@/components/toast";
import type { SortDirection } from "@/lib/sort";
import { defaultWeaponProgression } from "@/lib/weapon-scaling";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { WeaponCard } from "../weapon-card";
import { addWeapon } from "../actions";
import { WeaponProgressionForm } from "../weapon-progression-form";
import type { UpdateWeaponProgressionInput } from "../schemas";
import {
  filterAndSortWeaponCatalog,
  WEAPON_SECONDARY_STAT_NAMES,
  type WeaponCatalogItem,
  type CatalogSortKey,
} from "../filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function WeaponCatalog({
  catalog,
  initialWeaponType,
}: {
  catalog: WeaponCatalogItem[];
  initialWeaponType?: WeaponType;
}) {
  const [, startTransition] = useTransition();
  const { message, visible, showToast } = useToast();

  const [search, setSearch] = useState("");
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(
    () => new Set(initialWeaponType ? [initialWeaponType] : [])
  );
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [secondaryStatFilter, setSecondaryStatFilter] = useState("");
  const [sortKey, setSortKey] = useState<CatalogSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // The catalog card clicked to open the "customize before adding" modal --
  // unlike refinement (gone now, see below), this doesn't need to track a
  // value per weapon, just which one is currently open.
  const [customizingId, setCustomizingId] = useState<number | null>(null);

  const filtered = filterAndSortWeaponCatalog(catalog, {
    search,
    weaponTypeFilter,
    rarityFilter,
    secondaryStatFilter,
    sortKey,
    sortDirection,
  });
  const customizingWeapon = customizingId === null ? null : (catalog.find((w) => w.id === customizingId) ?? null);
  const customizingDefaults = customizingWeapon ? defaultWeaponProgression(customizingWeapon.name) : null;

  // Used by both the quick-add button (always this weapon's own default
  // state) and as the "customize before adding" modal's starting point
  // (from which the user can still change it before actually submitting).
  function handleQuickAdd(weapon: WeaponCatalogItem) {
    const input = defaultWeaponProgression(weapon.name);
    startTransition(async () => {
      const result = await addWeapon(weapon.id, input).catch(() => ({ errors: {} }) as const);
      if ("errors" in result) return;
      // Weapons can be added more than once (each is its own physical
      // copy), so the button itself never disables -- the same weapon
      // stays addable. A brief toast confirms the add instead.
      showToast(
        <>
          Added <span className="font-bold">{weapon.name}</span> · Lv.{input.level} R{input.refinement}
        </>
      );
    });
  }

  function handleCustomAdd(weapon: WeaponCatalogItem, input: UpdateWeaponProgressionInput) {
    setCustomizingId(null);
    startTransition(async () => {
      const result = await addWeapon(weapon.id, input).catch(() => ({ errors: {} }) as const);
      if ("errors" in result) return;
      showToast(
        <>
          Added <span className="font-bold">{weapon.name}</span> · Lv.{input.level} R{input.refinement}
        </>
      );
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
          className="rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
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
            hoverDetail={weapon.hoverDetail}
            actionLabel="Add"
            onAction={() => handleQuickAdd(weapon)}
            onSelect={() => setCustomizingId(weapon.id)}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No weapons match these filters.</p>}
      </ul>

      <Modal
        open={customizingWeapon !== null}
        onClose={() => setCustomizingId(null)}
        // max-w-4xl -- see owned-weapon-manager.tsx's own Modal usage for
        // why (Disaster and Remorse's passive text needing more room to
        // wrap into before hitting the ceiling).
        maxWidthClassName="max-w-4xl"
        fitContent
        closeButtonClassName="text-white hover:bg-white/10"
      >
        {customizingWeapon && customizingDefaults && (
          <WeaponProgressionForm
            key={customizingWeapon.id}
            weaponId={customizingWeapon.id}
            name={customizingWeapon.name}
            weaponType={customizingWeapon.weaponType}
            rarity={customizingWeapon.rarity}
            splashUrl={customizingWeapon.splashUrl}
            secondaryStatName={customizingWeapon.secondaryStatName}
            initialLevel={customizingDefaults.level}
            initialAscensionPhase={customizingDefaults.ascensionPhase}
            initialRefinement={customizingDefaults.refinement}
            formBackgroundClassName="bg-secondary-page"
            submitLabel="Add"
            onSubmit={(input) => handleCustomAdd(customizingWeapon, input)}
          />
        )}
      </Modal>

      <Toast message={message} visible={visible} />
    </div>
  );
}
