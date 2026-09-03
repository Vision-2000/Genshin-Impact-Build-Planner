"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { PaginationControls } from "../pagination-controls";
import { setCharacterOwnership } from "./actions";
import { ELEMENT_ICON_URL } from "./element-icons";
import { WEAPON_TYPE_ICON_URL } from "./weapon-type-icons";
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

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pageItems.map((character) => (
          <li key={character.id}>
            <button
              type="button"
              onClick={() => handleToggleOwnership(character.id, !character.isOwned)}
              aria-pressed={character.isOwned}
              className={`relative flex w-full flex-col items-center gap-2 rounded-xl border-8 p-3 pt-8 text-center shadow ${
                character.isOwned ? "border-green-500" : "border-gray-600"
              } ${
                character.rarity >= 5
                  ? "bg-gradient-to-b from-yellow-700 via-amber-700 to-yellow-900"
                  : "bg-gradient-to-b from-purple-800 via-purple-700 to-purple-950"
              }`}
            >
              <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
                <Image src={ELEMENT_ICON_URL[character.element]} alt={character.element} width={26} height={26} />
              </span>
              <span className="absolute right-2 top-2 h-9 w-9 rounded-full shadow">
                <Image
                  src={WEAPON_TYPE_ICON_URL[character.weaponType]}
                  alt={character.weaponType}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              </span>

              {character.iconUrl && (
                <div className="relative aspect-square w-full p-[6%]">
                  <Image
                    src={character.iconUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
                    className="rounded-full object-cover"
                  />
                </div>
              )}
              <p className="w-full truncate text-sm font-semibold text-white drop-shadow-sm">{character.name}</p>
            </button>
          </li>
        ))}
        {pageItems.length === 0 && <p className="text-sm text-gray-500">No characters match these filters.</p>}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
