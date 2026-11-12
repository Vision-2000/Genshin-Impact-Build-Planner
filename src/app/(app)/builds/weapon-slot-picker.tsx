"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WeaponType } from "@/generated/prisma/enums";
import { DEFAULT_WEAPON, DEFAULT_WEAPON_RARITY } from "@/lib/default-weapon";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import type { SortDirection } from "@/lib/sort";
import { WEAPON_SECONDARY_STAT_NAMES } from "../weapons/filter-sort";
import { WeaponCard } from "../weapons/weapon-card";
import type { OwnedWeaponOption } from "./filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

// Same 5 sort keys the owned-weapons page itself offers (see its own
// OwnedSortKey) -- "obtained" needs OwnedWeaponOption.createdAt, added
// alongside hoverDetail for exactly this kind of owned-page parity.
type SortKey = "name" | "rarity" | "refinement" | "level" | "obtained";

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Same convention as the owned-weapons page's own tiebreakByAdded: newest
// first, fixed regardless of the primary sort's own direction toggle,
// since two owned copies can never be created at the exact same moment.
function tiebreakByAdded(a: OwnedWeaponOption, b: OwnedWeaponOption): number {
  return b.createdAt - a.createdAt;
}

// Replaces a plain <select> -- a dropdown only has room for a weapon's name
// and refinement, which is enough to tell weapons apart, but the slot+modal
// pattern here exists mainly for parity with ArtifactSlotPicker (a select
// genuinely isn't enough there) and to give both a consistent feel. The
// picker's filters mirror the Weapons page (search, rarity, sort) -- weapon
// type is left out: once a character narrows `weaponType` to one value,
// every candidate already matches it, so the filter would never do
// anything; before that (weaponType null), it's simplest to just let the
// grid span every type rather than add a filter only needed in that one
// state.
//
// No "None" option (unlike the weaponType-null disabled state below, which
// is this picker having nothing to narrow candidates by, not a real
// unequipped state) -- a character always has SOME weapon equipped
// in-game, so `value === null` renders and totals as DEFAULT_WEAPON (see
// its own comment), not a blank slot. Still clickable, to swap in a real
// one.
export function WeaponSlotPicker({
  weaponType,
  weapons,
  value,
  onChange,
  autoOpen,
  onOpenChange,
  boxSizeClassName = "h-56 w-56",
  cardBorderClassName,
}: {
  // null only for BuildCatalog's own "no character chosen yet" state --
  // every candidate then spans every weapon type instead of just one (see
  // `options` below), since there's no character to narrow it by yet.
  weaponType: WeaponType | null;
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
  // Overridable for a caller that wants this slot more compact than the
  // default 224x224 (e.g. BuildCatalog's own top row, once it needs to fit
  // the weapon AND all 5 artifact slots alongside name/save) -- only
  // affects this closed/empty slot, never the modal's own grid, which stays
  // full size for picking regardless.
  boxSizeClassName?: string;
  // Forwarded to WeaponCard's own borderClassName for the selected display
  // only -- e.g. BuildCatalog's own compact weapon slot, where WeaponCard's
  // usual 8px border reads as too heavy at a much smaller box size.
  // Undefined keeps WeaponCard's own default.
  cardBorderClassName?: string;
}) {
  const [open, setOpenState] = useState(false);
  const [search, setSearch] = useState("");
  // Only rendered (see the modal below) when weaponType is null -- once a
  // character has narrowed every candidate to one type already, this
  // filter could never do anything (see this component's own top comment).
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [secondaryStatFilter, setSecondaryStatFilter] = useState("");
  // "obtained" (not "name") -- matches the owned-weapons page's own default
  // exactly, not just offering the same option.
  const [sortKey, setSortKey] = useState<SortKey>("obtained");
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

  const options = weaponType === null ? weapons : weapons.filter((w) => w.weaponType === weaponType);
  const selected = value !== null ? options.find((w) => w.ownedWeaponId === value) : undefined;

  const query = search.trim().toLowerCase();
  const direction = sortDirection === "desc" ? -1 : 1;
  const filtered = options
    .filter(
      (w) =>
        w.name.toLowerCase().includes(query) &&
        (weaponTypeFilter.size === 0 || weaponTypeFilter.has(w.weaponType)) &&
        (rarityFilter.size === 0 || rarityFilter.has(w.rarity)) &&
        (!secondaryStatFilter || w.secondaryStatName === secondaryStatFilter)
    )
    .sort((a, b) => {
      // Signs match the owned-weapons page's own comparator exactly
      // (filterAndSortOwnedWeapons), not just offering the same sort keys
      // -- rarity/refinement/level/obtained all flip the shared direction
      // multiplier (forward = highest/newest first), same tiebreakByAdded
      // convention too.
      if (sortKey === "rarity") return -direction * (a.rarity - b.rarity) || tiebreakByAdded(a, b);
      if (sortKey === "refinement") return -direction * (a.refinement - b.refinement) || tiebreakByAdded(a, b);
      if (sortKey === "level") return -direction * (a.level - b.level) || tiebreakByAdded(a, b);
      if (sortKey === "obtained") return -direction * (a.createdAt - b.createdAt);
      return direction * a.name.localeCompare(b.name) || tiebreakByAdded(a, b);
    });

  function select(ownedWeaponId: number | null) {
    onChange(ownedWeaponId);
    setOpen(false);
  }

  return (
    <>
      {selected ? (
        // Matches the artifact slot's own width -- WeaponCard is a plain
        // aspect-square card, so the width alone (boxSizeClassName's own
        // h-* is a no-op here, harmless) keeps it a square at whatever
        // size boxSizeClassName asks for.
        <ul className={`${boxSizeClassName} shrink-0`}>
          <WeaponCard
            name={selected.name}
            // selected's own type, not the (possibly null) prop above --
            // correct regardless of whether this was picked before or
            // after a character narrowed the candidates to one type.
            weaponType={selected.weaponType}
            rarity={selected.rarity}
            secondaryStatName={selected.secondaryStatName}
            iconUrl={selected.iconUrl}
            hoverDetail={selected.hoverDetail}
            onSelect={() => setOpen(true)}
            showWeaponTypeBadge={false}
            // No level/refinement badge, no name -- this box renders small
            // now (see BuildCatalog/BuildEditor's own compact
            // SLOT_SIZE_CLASS/EDITOR_SLOT_SIZE_CLASS), too little room for
            // that much text at once. All of it's still one hover away via
            // hoverDetail above.
            showName={false}
            borderClassName={cardBorderClassName}
          />
        </ul>
      ) : weaponType === null ? (
        // Disabled -- no character chosen yet, so there's no weapon type to
        // narrow candidates by and nothing meaningful to open. Not a
        // <button> (no click handler, no keyboard focus) -- a disabled
        // native control still needs explicit styling to read as inert, and
        // a plain non-interactive div gets there for free.
        <div
          title="Pick a character first"
          aria-disabled="true"
          className={`flex ${boxSizeClassName} shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-500 bg-foreground/5 opacity-40`}
        />
      ) : (
        // A character is picked but no real weapon chosen yet -- defaults
        // to (and totals as, see final-stats.ts) this type's own 1-star
        // starter weapon, same as a fresh in-game account, not a blank
        // slot. Still clickable, to swap in a real one.
        <ul className={`${boxSizeClassName} shrink-0`}>
          <WeaponCard
            name={DEFAULT_WEAPON[weaponType].name}
            weaponType={weaponType}
            rarity={DEFAULT_WEAPON_RARITY}
            secondaryStatName={null}
            iconUrl={DEFAULT_WEAPON[weaponType].iconUrl}
            onSelect={() => setOpen(true)}
            showWeaponTypeBadge={false}
            showName={false}
            borderClassName={cardBorderClassName}
          />
        </ul>
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
              className="rounded border bg-white px-3 py-2 text-sm text-black"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              {/* Same order as the owned-weapons page's own dropdown --
                  "Added" first, matching its own default sortKey, so the
                  selected option sits at the top of the opened list
                  instead of the bottom. */}
              <option value="obtained">Sort: Added</option>
              <option value="name">Sort: Name</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="refinement">Sort: Refinement</option>
              <option value="level">Sort: Level</option>
            </select>
            <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
            <select
              value={secondaryStatFilter}
              onChange={(event) => setSecondaryStatFilter(event.target.value)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="">Weapon stat: Any</option>
              {WEAPON_SECONDARY_STAT_NAMES.map((name) => (
                <option key={name} value={name}>
                  Weapon stat: {name}
                </option>
              ))}
            </select>
          </div>

          {/* Only shown once weaponType is null -- see this component's own
              top comment on why it would never do anything otherwise. */}
          {weaponType === null && (
            <WeaponTypeFilterRow
              weaponTypeFilter={weaponTypeFilter}
              onToggle={(type) => setWeaponTypeFilter((prev) => toggleInSet(prev, type))}
            />
          )}

          <RarityFilterRow
            rarities={RARITIES}
            rarityFilter={rarityFilter}
            onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
          />

          <p className="text-sm text-gray-500">
            Cannot find a weapon? Add one on the{" "}
            <Link
              href={weaponType ? `/weapons/add?weaponType=${weaponType}` : "/weapons/add"}
              className="underline hover:text-foreground"
            >
              Add weapon page
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto [scrollbar-gutter:stable] sm:grid-cols-4 md:grid-cols-5">
            {/* Switching back to the default 1-star starter is a real,
                legitimate choice (e.g. undoing an accidental pick, or
                deliberately comparing a build against its default-weapon
                baseline) -- not offering a way back to it here would make
                `value === null` a state this picker could enter but never
                return to. The weaponType check is really just a type
                narrow, not a real condition -- it's never null while this
                modal is reachable (the whole picker is disabled instead,
                see this component's own weaponType-null branch above). */}
            {weaponType && (
              <WeaponCard
                name={DEFAULT_WEAPON[weaponType].name}
                weaponType={weaponType}
                rarity={DEFAULT_WEAPON_RARITY}
                secondaryStatName={null}
                iconUrl={DEFAULT_WEAPON[weaponType].iconUrl}
                onSelect={() => select(null)}
                showWeaponTypeBadge={false}
                // border border-white -- same thin-border fix as the
                // compact slot card (marks where the card ends against
                // its own near-black bottom gradient, which otherwise
                // blends into this modal's own dark background). Swapped
                // for blue, same width, when this is the currently
                // equipped weapon (value === null) -- so it's obvious at
                // a glance which option is already selected instead of
                // having to close the modal to check.
                borderClassName={value === null ? "border border-blue-500" : "border border-white"}
              />
            )}
            {filtered.map((weapon) => (
              <WeaponCard
                key={weapon.ownedWeaponId}
                name={weapon.name}
                // weapon's own type, not the (possibly null) prop above --
                // candidates span every type when no character has
                // narrowed this down yet.
                weaponType={weapon.weaponType}
                rarity={weapon.rarity}
                secondaryStatName={weapon.secondaryStatName}
                iconUrl={weapon.iconUrl}
                refinement={weapon.refinement}
                level={weapon.level}
                hoverDetail={weapon.hoverDetail}
                onSelect={() => select(weapon.ownedWeaponId)}
                showWeaponTypeBadge={false}
                borderClassName={weapon.ownedWeaponId === value ? "border border-blue-500" : "border border-white"}
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No weapons match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
