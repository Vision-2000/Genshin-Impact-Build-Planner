"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2 L14.9 9.1 L22.5 9.7 L16.7 14.6 L18.5 22 L12 17.8 L5.5 22 L7.3 14.6 L1.5 9.7 L9.1 9.1 Z" />
    </svg>
  );
}

const ELEMENTS = Object.values(Element);
const WEAPON_TYPES = Object.values(WeaponType);
// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

export function CharacterRoster({ initialCharacters }: { initialCharacters: CharacterListItem[] }) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      filterAndSortCharacters(characters, {
        search,
        elementFilter,
        weaponTypeFilter,
        rarityFilter,
        ownershipFilter,
        sortKey,
      }),
    [characters, search, elementFilter, weaponTypeFilter, rarityFilter, ownershipFilter, sortKey]
  );

  function toggleElement(element: Element) {
    setElementFilter((prev) => {
      const next = new Set(prev);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      return next;
    });
  }

  function toggleWeaponType(weaponType: WeaponType) {
    setWeaponTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(weaponType)) next.delete(weaponType);
      else next.add(weaponType);
      return next;
    });
  }

  function toggleRarity(rarity: number) {
    setRarityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
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
          onChange={(event) => setSearch(event.target.value)}
          className="rounded border px-3 py-2 text-sm bg-white text-black"
        />

        <select
          value={ownershipFilter}
          onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
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
            aria-pressed={elementFilter.has(element)}
            title={element}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/40 p-1.5 ring-2 ${
              elementFilter.has(element) ? "ring-blue-500" : "ring-foreground"
            }`}
          >
            <Image src={ELEMENT_ICON_URL[element]} alt={element} width={24} height={24} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {WEAPON_TYPES.map((weaponType) => (
          <button
            key={weaponType}
            type="button"
            onClick={() => toggleWeaponType(weaponType)}
            aria-pressed={weaponTypeFilter.has(weaponType)}
            title={weaponType}
            className={`h-10 w-10 rounded-full ring-2 ${
              weaponTypeFilter.has(weaponType) ? "ring-blue-500" : "ring-foreground"
            }`}
          >
            <Image
              src={WEAPON_TYPE_ICON_URL[weaponType]}
              alt={weaponType}
              width={40}
              height={40}
              className="rounded-full"
            />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {RARITIES.map((rarity) => (
          <button
            key={rarity}
            type="button"
            onClick={() => toggleRarity(rarity)}
            aria-pressed={rarityFilter.has(rarity)}
            title={`${rarity} star`}
            className={`flex h-10 items-center gap-0.5 rounded-full bg-black/40 pl-2 pr-1.5 ring-2 ${
              rarityFilter.has(rarity) ? "ring-blue-500" : "ring-foreground"
            }`}
          >
            <span className="text-sm font-medium text-white">{rarity}</span>
            <StarIcon className="h-4 w-4 text-yellow-400" />
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        {filtered.length} character{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((character) => (
          <li key={character.id}>
            <button
              type="button"
              onClick={() => handleToggleOwnership(character.id, !character.isOwned)}
              aria-pressed={character.isOwned}
              className={`relative aspect-square w-full overflow-hidden rounded-xl border-8 text-left shadow ${
                character.isOwned ? "border-green-500" : "border-gray-600"
              } ${
                character.rarity >= 5
                  ? "bg-gradient-to-b from-yellow-700 via-amber-700 to-yellow-900"
                  : "bg-gradient-to-b from-purple-800 via-purple-700 to-purple-950"
              }`}
            >
              {character.iconUrl && (
                <Image
                  src={character.iconUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
                  className="object-cover"
                />
              )}

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

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-8">
                <p className="truncate text-center text-lg font-semibold text-white">{character.name}</p>
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No characters match these filters.</p>}
      </ul>
    </div>
  );
}
