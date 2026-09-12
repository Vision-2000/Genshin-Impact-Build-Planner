"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { WeaponCard } from "../weapons/weapon-card";
import type { OwnedWeaponOption } from "./filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

type SortKey = "name" | "rarity" | "refinement";

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Sits alongside the real WeaponCard entries in the picker's grid so "no
// weapon" is just another option to click, not a separate row above the
// grid. Kept local rather than folded into WeaponCard itself -- WeaponCard's
// other two call sites (owned weapons, add-weapon catalog) always represent
// a real weapon, so an "empty" variant would only ever be exercised here.
function NoneWeaponCard({ onSelect }: { onSelect: () => void }) {
  return (
    <li>
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect();
        }}
        className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-xl border-8 border-gray-600 bg-foreground/10 shadow hover:opacity-90"
      >
        <span className="text-lg font-semibold text-gray-400">None</span>
      </div>
    </li>
  );
}

// Replaces a plain <select> -- a dropdown only has room for a weapon's name
// and refinement, which is enough to tell weapons apart, but the slot+modal
// pattern here exists mainly for parity with ArtifactSlotPicker (a select
// genuinely isn't enough there) and to give both a consistent feel. The
// picker's filters mirror the Weapons page (search, rarity, sort) -- weapon
// type is left out since every candidate here already matches the
// character's own weapon type, so that filter would never do anything.
export function WeaponSlotPicker({
  weaponType,
  weapons,
  value,
  onChange,
  autoOpen,
  onOpenChange,
}: {
  weaponType: WeaponType;
  weapons: OwnedWeaponOption[];
  value: number | null;
  onChange: (ownedWeaponId: number | null) => void;
  // Lets a caller that persists its own state (e.g. BuildCatalog's
  // sessionStorage draft) reopen this picker after a remount, and stay
  // informed when it opens/closes normally so that persisted state doesn't
  // go stale. Both optional -- callers that don't care about surviving
  // navigation (e.g. the owned-build edit modal) can ignore them entirely.
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  // Fires when a caller's restored draft flips autoOpen to true after this
  // component has already mounted closed (the parent's own restore effect
  // runs post-hydration too, so this can't just be an initial state value).
  // Deliberate exception to react-hooks/set-state-in-effect -- this is
  // exactly the "synchronize with a value owned by an external system"
  // case (the caller's own persisted draft), not derived-state busywork.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const options = weapons.filter((w) => w.weaponType === weaponType);
  const selected = value !== null ? options.find((w) => w.ownedWeaponId === value) : undefined;

  const query = search.trim().toLowerCase();
  const direction = sortDirection === "desc" ? -1 : 1;
  const filtered = options
    .filter((w) => w.name.toLowerCase().includes(query) && (rarityFilter.size === 0 || rarityFilter.has(w.rarity)))
    .sort((a, b) => {
      if (sortKey === "rarity") return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
      if (sortKey === "refinement") return direction * (a.refinement - b.refinement) || a.name.localeCompare(b.name);
      return direction * a.name.localeCompare(b.name);
    });

  function select(ownedWeaponId: number | null) {
    onChange(ownedWeaponId);
    setOpen(false);
  }

  return (
    <>
      {selected ? (
        // Matches the artifact slot's w-56 width -- WeaponCard is a plain
        // aspect-square card, so this alone keeps it a 224x224 square.
        <ul className="w-56 shrink-0">
          <WeaponCard
            name={selected.name}
            weaponType={weaponType}
            rarity={selected.rarity}
            secondaryStatName={selected.secondaryStatName}
            iconUrl={selected.iconUrl}
            refinement={selected.refinement}
            onSelect={() => setOpen(true)}
            showName={false}
            showWeaponTypeBadge={false}
          />
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Choose weapon"
          className="relative flex h-56 w-56 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-foreground/10 p-1 hover:opacity-90"
        >
          <Image src={WEAPON_TYPE_ICON_URL[weaponType]} alt="" fill className="object-contain p-1 opacity-30" />
          <BlinkingPlusIcon />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Choose weapon" maxWidthClassName="max-w-4xl">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Search by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 rounded border bg-white px-3 py-2 text-sm text-black"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="name">Sort: Name</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="refinement">Sort: Refinement</option>
            </select>
            <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
          </div>

          <RarityFilterRow
            rarities={RARITIES}
            rarityFilter={rarityFilter}
            onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
          />

          <p className="text-sm text-gray-500">
            Cannot find a weapon? Add one on the{" "}
            <Link href={`/weapons/add?weaponType=${weaponType}`} className="underline hover:text-foreground">
              Add weapon page
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            <NoneWeaponCard onSelect={() => select(null)} />
            {filtered.map((weapon) => (
              <WeaponCard
                key={weapon.ownedWeaponId}
                name={weapon.name}
                weaponType={weaponType}
                rarity={weapon.rarity}
                secondaryStatName={weapon.secondaryStatName}
                iconUrl={weapon.iconUrl}
                refinement={weapon.refinement}
                onSelect={() => select(weapon.ownedWeaponId)}
                showName={false}
                showWeaponTypeBadge={false}
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No weapons match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
