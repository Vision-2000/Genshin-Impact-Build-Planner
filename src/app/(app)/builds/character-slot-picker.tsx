"use client";

import { useState } from "react";
import Link from "next/link";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { SplashImage } from "@/components/splash-image";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import type { SortDirection } from "@/lib/sort";
import { ElementFilterRow } from "../characters/element-filter-row";
import { CharacterCard } from "../characters/character-card";
import type { OwnedCharacterOption } from "./filter-sort";

// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

type SortKey = "name" | "rarity";

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Sits alongside the real CharacterCard entries in the picker's grid so
// clearing back to "no character chosen" is just another option to click,
// not a separate control outside the grid. A build still ultimately needs
// a real character to save (see CreateBuildInputSchema) -- BuildCatalog's
// own Save button already disables for that -- this only lets the in-
// progress choice be cleared, the same way WeaponSlotPicker's own "no
// weapon" option works for an actually-optional field.
function NoneCharacterCard({ onSelect }: { onSelect: () => void }) {
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

// Replaces a plain <select> -- mirrors WeaponSlotPicker/ArtifactSlotPicker's
// grid-of-cards pattern (search, filters, sort, a link to the roster page
// for a missing character, a "None" option), reusing the same CharacterCard
// the Characters pages use so a character looks the same wherever it's
// shown. Unlike those two pickers, a build's character is REQUIRED (see
// CreateBuildInputSchema) -- "None" only clears the in-progress choice, it
// doesn't represent a real valid state to save with. Also unlike those two,
// the SELECTED state isn't a small square -- it's a full splash-art column
// (same SplashImage/rarityGradientClasses treatment the character/weapon
// progression editors use for their own left column), since BuildCatalog
// embeds this as the build form's entire left column rather than one slot
// among several equal-sized ones.
export function CharacterSlotPicker({
  characters,
  value,
  onChange,
}: {
  characters: OwnedCharacterOption[];
  value: number | null;
  onChange: (ownedCharacterId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const selected = value !== null ? characters.find((c) => c.ownedCharacterId === value) : undefined;

  const query = search.trim().toLowerCase();
  const direction = sortDirection === "desc" ? -1 : 1;
  const filtered = characters
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query) &&
        (elementFilter.size === 0 || elementFilter.has(c.element)) &&
        (weaponTypeFilter.size === 0 || weaponTypeFilter.has(c.weaponType)) &&
        (rarityFilter.size === 0 || rarityFilter.has(c.rarity))
    )
    .sort((a, b) => {
      if (sortKey === "rarity") return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
      return direction * a.name.localeCompare(b.name);
    });

  function select(ownedCharacterId: number | null) {
    onChange(ownedCharacterId);
    setOpen(false);
  }

  return (
    <>
      {selected ? (
        // h-64 sm:h-auto -- fixed height on a narrow viewport (matching the
        // progression editors' own splash column), stretching to match the
        // form's right-hand column's real height once there's room for a
        // side-by-side row (BuildCatalog's own flex-row parent default-
        // stretches its children). w-96 matches those same editors' own
        // left-column width.
        <div
          onClick={() => setOpen(true)}
          role="button"
          tabIndex={0}
          title="Choose character"
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setOpen(true);
          }}
          className={`relative h-64 w-full shrink-0 cursor-pointer overflow-hidden shadow hover:opacity-90 sm:h-auto sm:w-96 ${rarityGradientClasses(selected.rarity)}`}
        >
          {selected.splashUrl && (
            // key={selected.splashUrl} remounts SplashImage fresh whenever
            // the selected character changes, so its own "loaded" state
            // always starts over instead of carrying over true from
            // whatever was shown before.
            <SplashImage key={selected.splashUrl} src={selected.splashUrl} objectFit="cover" />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Choose character"
          className="relative flex h-64 w-full shrink-0 items-center justify-center overflow-hidden border-2 border-white bg-foreground/10 p-1 hover:opacity-90 sm:h-auto sm:w-96"
        >
          <BlinkingPlusIcon />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Choose character" maxWidthClassName="max-w-4xl">
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
            </select>
            <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
          </div>

          <ElementFilterRow
            elementFilter={elementFilter}
            onToggle={(element) => setElementFilter((prev) => toggleInSet(prev, element))}
          />
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
            Cannot find a character? Mark them owned on the{" "}
            <Link href="/characters/roster" className="underline hover:text-foreground">
              Characters roster
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            <NoneCharacterCard onSelect={() => select(null)} />
            {filtered.map((character) => (
              <CharacterCard
                key={character.ownedCharacterId}
                name={character.name}
                element={character.element}
                weaponType={character.weaponType}
                rarity={character.rarity}
                iconUrl={character.iconUrl}
                onSelect={() => select(character.ownedCharacterId)}
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No characters match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
