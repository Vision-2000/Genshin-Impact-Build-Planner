"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { setCharacterOwnership } from "./actions";
import {
  filterAndSortCharacters,
  type CharacterListItem,
  type OwnershipFilter,
  type SortKey,
} from "./filter-sort";

export type { CharacterListItem };

const ELEMENTS = Object.values(Element);
const WEAPON_TYPES = Object.values(WeaponType);
const PAGE_SIZE = 24;

export function CharacterRoster({ initialCharacters }: { initialCharacters: CharacterListItem[] }) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

  const filtered = useMemo(
    () => filterAndSortCharacters(characters, { search, elementFilter, weaponTypeFilter, ownershipFilter, sortKey }),
    [characters, search, elementFilter, weaponTypeFilter, ownershipFilter, sortKey]
  );

  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);

  function resetToFirstPage() {
    setPage(1);
  }

  function toggleElement(element: Element) {
    setElementFilter((prev) => {
      const next = new Set(prev);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      return next;
    });
    resetToFirstPage();
  }

  function toggleWeaponType(weaponType: WeaponType) {
    setWeaponTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(weaponType)) next.delete(weaponType);
      else next.add(weaponType);
      return next;
    });
    resetToFirstPage();
  }

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
          onChange={(event) => {
            setSearch(event.target.value);
            resetToFirstPage();
          }}
          className="rounded border px-3 py-2 text-sm bg-white text-black"
        />

        <select
          value={ownershipFilter}
          onChange={(event) => {
            setOwnershipFilter(event.target.value as OwnershipFilter);
            resetToFirstPage();
          }}
          className="rounded border px-3 py-2 text-sm bg-white text-black"
        >
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="unowned">Not owned</option>
        </select>

        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="rounded border px-3 py-2 text-sm bg-white text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {ELEMENTS.map((element) => (
          <button
            key={element}
            type="button"
            onClick={() => toggleElement(element)}
            className={`rounded-full border px-3 py-1 text-xs ${
              elementFilter.has(element) ? "bg-foreground text-background" : ""
            }`}
          >
            {element}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {WEAPON_TYPES.map((weaponType) => (
          <button
            key={weaponType}
            type="button"
            onClick={() => toggleWeaponType(weaponType)}
            className={`rounded-full border px-3 py-1 text-xs ${
              weaponTypeFilter.has(weaponType) ? "bg-foreground text-background" : ""
            }`}
          >
            {weaponType}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        {filtered.length} character{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {pageItems.map((character) => (
          <li key={character.id} className="flex items-center gap-3 rounded border p-3">
            {character.iconUrl && (
              <Image
                src={character.iconUrl}
                alt=""
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{character.name}</p>
              <p className="text-xs text-gray-500">
                {character.rarity}★ {character.element}
              </p>
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={character.isOwned}
                onChange={(event) => handleToggleOwnership(character.id, event.target.checked)}
              />
              Owned
            </label>
          </li>
        ))}
        {pageItems.length === 0 && <p className="text-sm text-gray-500">No characters match these filters.</p>}
      </ul>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={currentPage === 1}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          disabled={currentPage === pageCount}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
