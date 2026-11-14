"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { SplashImage } from "@/components/splash-image";
import { characterLevelDisplayCap } from "@/lib/ascension";
import { elementBackgroundClass } from "@/lib/element-colors";
import type { SortDirection } from "@/lib/sort";
import { ElementFilterRow } from "../characters/element-filter-row";
import { CharacterCard } from "../characters/character-card";
import type { OwnedCharacterOption } from "./filter-sort";

// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

// Same sort keys the OWNED characters page itself offers (its own
// OwnedSortKey, not the roster's own RosterSortKey -- this picker only
// ever lists already-owned characters, same scope as that page, not the
// roster's "every character, toggle ownership" scope).
type SortKey = "name" | "rarity" | "level";

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
      {/* border border-white -- matches the real CharacterCard entries
          in this same grid now, for consistency, not because this
          card's own light bg-foreground/10 fill has the same
          blends-into-black problem those have. */}
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect();
        }}
        className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-xl border border-white bg-foreground/10 shadow hover:opacity-90"
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
// (same SplashImage/elementBackgroundClass treatment the character
// progression editor uses for its own left column -- element-tinted, not
// rarity-tinted, since that's what the character page itself does), since
// BuildCatalog embeds this as the build form's entire left column rather
// than one slot among several equal-sized ones.
export function CharacterSlotPicker({
  characters,
  value,
  onChange,
  autoOpen,
  onOpenChange,
  locked = false,
}: {
  characters: OwnedCharacterOption[];
  value: number | null;
  onChange: (ownedCharacterId: number | null) => void;
  // Same as WeaponSlotPicker/ArtifactSlotPicker's own autoOpen/onOpenChange
  // -- lets BuildCatalog's sessionStorage draft reopen this picker after a
  // remount (e.g. following this picker's own "mark them owned on the
  // roster" link and coming back), and stay informed when it opens/closes
  // normally so that persisted state doesn't go stale. Both optional --
  // callers that don't care about surviving navigation can ignore them
  // entirely.
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Owned-builds edit modal only -- a build's character can't be changed
  // after creation, so this strips the splash's own click-to-open
  // affordance entirely (no onClick/cursor-pointer/hover/keyboard
  // activation) and the "Choose character" modal below is simply never
  // triggered. Unlike WeaponSlotPicker's weaponType-null disabled state,
  // this isn't "nothing to narrow candidates by yet" -- there's a real,
  // known character here, it's just not editable.
  locked?: boolean;
}) {
  const [open, setOpenState] = useState(false);
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  // Fires when a caller's restored draft flips autoOpen to true after this
  // component has already mounted closed (the parent's own restore effect
  // runs post-hydration too, so this can't just be an initial state value)
  // -- same pattern and same reasoning as WeaponSlotPicker's own identical
  // effect. Deliberate exception to react-hooks/set-state-in-effect -- this
  // is exactly the "synchronize with a value owned by an external system"
  // case (the caller's own persisted draft), not derived-state busywork.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

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
      // Both flipped (-direction, not direction) -- matches the owned
      // characters page's own comparator exactly
      // (filterAndSortOwnedCharacters): forward is highest rarity/level
      // first.
      if (sortKey === "rarity") return -direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
      if (sortKey === "level") return -direction * (a.level - b.level) || a.name.localeCompare(b.name);
      return direction * a.name.localeCompare(b.name);
    });

  function select(ownedCharacterId: number | null) {
    onChange(ownedCharacterId);
    setOpen(false);
  }

  return (
    <>
      {/* "Character" labeled the same way BuildCatalog's own "Weapon"/
          "Artifacts" labels sit above THOSE pickers -- this one's self-
          contained (not added by the caller). w-96 matches the progression
          editors' own left-column width. */}
      {/* pb-2 pl-2 on the whole column (not just the label) -- gives the
          splash art itself some breathing room from the outer panel's own
          left/bottom edges, matching the padded feel of BuildCatalog's own
          "Weapon"/"Artifacts" labels and their column's own p-4, rather
          than sitting flush against it. No pr/pt here -- those edges are
          either an intentional seam against the form's right column, or
          already covered by the label's own pt-2 below. */}
      <div className="flex w-full shrink-0 flex-col gap-1 pb-2 pl-2 sm:w-96">
        <p className="pt-2 text-base font-bold">Character</p>
        {selected ? (
          // aspect-[3/4] (not flex-1/min-h-64) -- a fixed height derived
          // from this column's own width, independent of whatever height
          // the Weapon/Artifacts row next to it happens to need. flex-1
          // previously stretched this to match that row, which left it
          // looking squished once that row's own boxes shrank (see
          // BuildCatalog's own SLOT_SIZE_CLASS). border-2 border-white --
          // same thin border the empty placeholder state below already
          // has, now applied here too: the splash art's own bottom
          // gradient overlay fades to near-black, which otherwise blends
          // invisibly into the page's own black background (same
          // reasoning as the Weapon/Artifact slot cards' own border
          // border-white fix).
          <div
            onClick={locked ? undefined : () => setOpen(true)}
            role={locked ? undefined : "button"}
            tabIndex={locked ? undefined : 0}
            title={locked ? undefined : "Choose character"}
            onKeyDown={
              locked
                ? undefined
                : (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setOpen(true);
                  }
            }
            className={`relative aspect-[3/4] w-full overflow-hidden rounded-lg border-2 border-white shadow ${
              locked ? "" : "cursor-pointer hover:opacity-90"
            } ${elementBackgroundClass(selected.element)}`}
          >
            {selected.splashUrl && (
              // key={selected.splashUrl} remounts SplashImage fresh whenever
              // the selected character changes, so its own "loaded" state
              // always starts over instead of carrying over true from
              // whatever was shown before.
              <SplashImage key={selected.splashUrl} src={selected.splashUrl} objectFit="cover" />
            )}

            {/* Top-left level badge -- same dark-badge treatment WeaponCard's
                own level badge uses (top-right there; there's no competing
                weapon-type badge here to share the corner with, so this one
                sits top-left instead). */}
            <span className="absolute left-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow">
              <span className="mt-0.5 text-sm font-semibold leading-none text-white">
                Lv.{selected.level}/{characterLevelDisplayCap(selected.level, selected.ascensionPhase)}
              </span>
            </span>

            {/* Name overlay -- same bottom gradient + centered name
                CharacterCard's own square cards use, just scaled up
                (text-2xl, not text-lg) for this column's own larger size. */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-10">
              <p className="truncate text-center text-2xl font-semibold text-white">{selected.name}</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={locked ? undefined : () => setOpen(true)}
            disabled={locked}
            title={locked ? undefined : "Choose character"}
            className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-foreground/10 p-1 hover:opacity-90 disabled:opacity-40"
          >
            <BlinkingPlusIcon />
          </button>
        )}
      </div>

      {!locked && (
      <Modal open={open} onClose={() => setOpen(false)} title="Choose character" maxWidthClassName="max-w-4xl">
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
              <option value="name">Sort: Name</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="level">Sort: Level</option>
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

          <p className="text-sm text-gray-300">
            Cannot find a character? Mark them owned on the{" "}
            <Link href="/characters/roster" className="underline hover:text-foreground">
              Characters roster
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto [scrollbar-gutter:stable] sm:grid-cols-4 md:grid-cols-5">
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
                // border border-white -- same thin-border fix as the
                // Weapon/Artifact slot cards (marks where the card ends
                // against its own near-black bottom gradient, which
                // otherwise blends into this modal's own dark background).
                borderClassName="border border-white"
                progression={{
                  level: character.level,
                  ascensionPhase: character.ascensionPhase,
                  constellation: character.constellation,
                  normalAttackLevel: character.normalAttackLevel,
                  skillLevel: character.skillLevel,
                  burstLevel: character.burstLevel,
                }}
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-300">No characters match this search.</p>}
        </div>
      </Modal>
      )}
    </>
  );
}
