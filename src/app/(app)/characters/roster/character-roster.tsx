"use client";

import { useState, useTransition } from "react";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import type { SortDirection } from "@/lib/sort";
import { setCharacterOwnership } from "../actions";
import { CharacterCard } from "../character-card";
import { ElementFilterRow } from "../element-filter-row";
import {
  filterAndSortCharacterRoster,
  type CharacterRosterItem,
  type OwnershipFilter,
  type RosterSortKey,
} from "../filter-sort";

// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Unlike Weapons/Artifacts' add pages (which only ever add a new physical
// copy), a character has just one ownership flag -- so clicking a card here
// toggles it either way. This page is deliberately just the toggle, not an
// editor: level/ascension/constellation/talent editing lives on /characters
// (the primary page) instead, opened by clicking an owned card there.
// Toggling off here keeps the OwnedCharacter row (never deletes it), so
// that progression data survives an accidental off/on, same reasoning as
// Weapons/Artifacts never deleting on ownership toggle.
export function CharacterRoster({ roster }: { roster: CharacterRosterItem[] }) {
  const [characters, setCharacters] = useState(roster);
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [sortKey, setSortKey] = useState<RosterSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [, startTransition] = useTransition();

  const filtered = filterAndSortCharacterRoster(characters, {
    search,
    elementFilter,
    weaponTypeFilter,
    rarityFilter,
    ownershipFilter,
    sortKey,
    sortDirection,
  });

  function handleToggleOwnership(characterId: number, nextIsOwned: boolean) {
    setCharacters((prev) =>
      prev.map((character) => (character.id === characterId ? { ...character, isOwned: nextIsOwned } : character))
    );

    startTransition(() => {
      setCharacterOwnership(characterId, nextIsOwned).catch(() => {
        setCharacters((prev) =>
          prev.map((character) =>
            character.id === characterId ? { ...character, isOwned: !nextIsOwned } : character
          )
        );
      });
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
          value={ownershipFilter}
          onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="unowned">Not owned</option>
        </select>
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as RosterSortKey)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
      </div>

      <ElementFilterRow elementFilter={elementFilter} onToggle={(element) => setElementFilter((prev) => toggleInSet(prev, element))} />
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
        {filtered.length} character{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((character) => (
          <CharacterCard
            key={character.id}
            name={character.name}
            element={character.element}
            weaponType={character.weaponType}
            rarity={character.rarity}
            iconUrl={character.iconUrl}
            isOwned={character.isOwned}
            showOwnershipBorder
            onSelect={() => handleToggleOwnership(character.id, !character.isOwned)}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No characters match these filters.</p>}
      </ul>
    </div>
  );
}
