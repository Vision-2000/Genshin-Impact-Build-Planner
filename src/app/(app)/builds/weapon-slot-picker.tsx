"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={selected ? `${selected.name} (R${selected.refinement})` : "Choose weapon"}
        className={`relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-white p-1 hover:opacity-90 ${
          selected ? rarityGradientClasses(selected.rarity) : "bg-foreground/10"
        }`}
      >
        {selected ? (
          selected.iconUrl && <Image src={selected.iconUrl} alt="" width={104} height={104} />
        ) : (
          <>
            <Image
              src={WEAPON_TYPE_ICON_URL[weaponType]}
              alt=""
              fill
              className="object-contain p-1 opacity-30"
            />
            <svg
              viewBox="0 0 16 16"
              width={64}
              height={64}
              className="relative text-foreground [animation:blink_2.5s_ease-in-out_infinite]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M8 2v12M2 8h12" />
            </svg>
          </>
        )}
      </button>

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

          <button
            type="button"
            onClick={() => select(null)}
            className="flex w-full items-center gap-3 rounded border p-2 text-left text-sm hover:bg-black/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-foreground/10 text-gray-400">
              —
            </div>
            None
          </button>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
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
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No weapons match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
