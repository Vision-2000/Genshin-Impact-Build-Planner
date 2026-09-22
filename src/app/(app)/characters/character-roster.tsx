"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { MIN_LEVEL, MAX_LEVEL, validAscensionPhasesForLevel } from "@/lib/ascension";
import {
  setCharacterOwnership,
  updateCharacterProgression,
  getCharacterConstellationBoosts,
  type CharacterConstellationBoost,
} from "./actions";
import {
  MIN_CONSTELLATION,
  MAX_CONSTELLATION,
  computeTalentLevelBounds,
  type TalentLevelBounds,
  type UpdateCharacterProgressionInput,
} from "./schemas";
import { ELEMENT_ICON_URL } from "./element-icons";
import {
  filterAndSortCharacters,
  type CharacterListItem,
  type OwnershipFilter,
  type SortKey,
  type SortDirection,
} from "./filter-sort";

export type { CharacterListItem };

const ELEMENTS = Object.values(Element);
const WEAPON_TYPES = Object.values(WeaponType);
// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 2.5l3 3L6 13l-3.5 1L4 10.5z" />
    </svg>
  );
}

// Shifts a talent level by the same amount its bounds just shifted (e.g.
// +3 when its constellation just unlocked, -3 when it just got locked back
// out by lowering the constellation selector), rather than just clamping at
// the new edges -- this preserves the "invested" part of the level across
// the toggle, matching how the game itself immediately reflects a
// constellation's talent boost in the displayed level.
function adjustTalentLevel(value: number, oldBounds: TalentLevelBounds, newBounds: TalentLevelBounds): number {
  const shifted = value + (newBounds.min - oldBounds.min);
  return Math.min(newBounds.max, Math.max(newBounds.min, shifted));
}

// Modal body for editing level/ascension/constellation/talent levels.
// Ascension is constrained by level (see WeaponProgressionEditor's
// counterpart in weapons/owned-weapon-manager.tsx for the same pattern).
// Talent level bounds additionally depend on which constellations are
// unlocked, fetched lazily here rather than bundled into the main roster
// query -- only the character currently being edited needs this.
function CharacterProgressionEditor({
  character,
  onSave,
}: {
  character: CharacterListItem;
  onSave: (input: UpdateCharacterProgressionInput) => void;
}) {
  const [level, setLevel] = useState(character.level);
  const [ascensionPhase, setAscensionPhase] = useState(character.ascensionPhase);
  const [constellation, setConstellation] = useState(character.constellation);
  const [normalAttackLevel, setNormalAttackLevel] = useState(character.normalAttackLevel);
  const [skillLevel, setSkillLevel] = useState(character.skillLevel);
  const [burstLevel, setBurstLevel] = useState(character.burstLevel);
  const [constellations, setConstellations] = useState<CharacterConstellationBoost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCharacterConstellationBoosts(character.id).then((result) => {
      if (!cancelled) setConstellations(result);
    });
    return () => {
      cancelled = true;
    };
  }, [character.id]);

  const validPhases = validAscensionPhasesForLevel(level);
  const maxValidPhase = Math.max(...validPhases);
  const talentLevelBounds = constellations ? computeTalentLevelBounds(constellation, constellations) : null;

  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    const phases = validAscensionPhasesForLevel(newLevel);
    if (!phases.includes(ascensionPhase)) {
      setAscensionPhase(phases[phases.length - 1]);
    }
  }

  function handleConstellationChange(newConstellation: number) {
    if (!constellations) {
      // Bounds aren't known yet -- shouldn't be reachable since the
      // constellation control is disabled until they load, but keep this
      // safe rather than silently dropping the new value.
      setConstellation(newConstellation);
      return;
    }
    const oldBounds = computeTalentLevelBounds(constellation, constellations);
    const newBounds = computeTalentLevelBounds(newConstellation, constellations);
    setConstellation(newConstellation);
    setNormalAttackLevel((v) => adjustTalentLevel(v, oldBounds.normalAttackLevel, newBounds.normalAttackLevel));
    setSkillLevel((v) => adjustTalentLevel(v, oldBounds.skillLevel, newBounds.skillLevel));
    setBurstLevel((v) => adjustTalentLevel(v, oldBounds.burstLevel, newBounds.burstLevel));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg ${rarityGradientClasses(character.rarity)}`}
        >
          {character.iconUrl && <Image src={character.iconUrl} alt="" width={56} height={56} className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{character.name}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Level
        <input
          type="range"
          min={MIN_LEVEL}
          max={MAX_LEVEL}
          value={level}
          onChange={(event) => handleLevelChange(Number(event.target.value))}
          className="-mt-1 w-32"
        />
        <span className="w-8 text-gray-400">{level}</span>
      </label>

      {validPhases.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          Ascension:
          <select
            value={ascensionPhase}
            onChange={(event) => setAscensionPhase(Number(event.target.value))}
            className="h-8 rounded border bg-white px-2 text-sm text-black"
          >
            {validPhases.map((phase) => (
              <option key={phase} value={phase}>
                Phase {phase} {phase === maxValidPhase ? "(ascended)" : "(pre-ascension)"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-gray-500">Ascension: Phase {ascensionPhase}</p>
      )}

      <label className="flex items-center gap-2 text-sm">
        Constellation:
        <select
          value={constellation}
          onChange={(event) => handleConstellationChange(Number(event.target.value))}
          disabled={!constellations}
          className="h-8 rounded border bg-white px-2 text-sm text-black disabled:bg-gray-100 disabled:text-gray-500"
        >
          {Array.from({ length: MAX_CONSTELLATION - MIN_CONSTELLATION + 1 }, (_, i) => MIN_CONSTELLATION + i).map(
            (n) => (
              <option key={n} value={n}>
                C{n}
              </option>
            )
          )}
        </select>
      </label>

      <div className="space-y-1">
        <p className="text-sm font-medium">Talent levels</p>
        {!talentLevelBounds ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0">Normal Attack</span>
              <input
                type="range"
                min={talentLevelBounds.normalAttackLevel.min}
                max={talentLevelBounds.normalAttackLevel.max}
                value={normalAttackLevel}
                onChange={(event) => setNormalAttackLevel(Number(event.target.value))}
                className="w-32"
              />
              <span className="w-8 text-gray-400">{normalAttackLevel}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0">Skill</span>
              <input
                type="range"
                min={talentLevelBounds.skillLevel.min}
                max={talentLevelBounds.skillLevel.max}
                value={skillLevel}
                onChange={(event) => setSkillLevel(Number(event.target.value))}
                className="w-32"
              />
              <span className="w-8 text-gray-400">{skillLevel}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0">Burst</span>
              <input
                type="range"
                min={talentLevelBounds.burstLevel.min}
                max={talentLevelBounds.burstLevel.max}
                value={burstLevel}
                onChange={(event) => setBurstLevel(Number(event.target.value))}
                className="w-32"
              />
              <span className="w-8 text-gray-400">{burstLevel}</span>
            </label>
          </>
        )}
      </div>

      <div className="flex justify-end border-t pt-3">
        <button
          type="button"
          disabled={!talentLevelBounds}
          onClick={() =>
            onSave({ level, ascensionPhase, constellation, normalAttackLevel, skillLevel, burstLevel })
          }
          className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function CharacterRoster({ initialCharacters }: { initialCharacters: CharacterListItem[] }) {
  useRefreshOnBackNavigation();
  const [characters, setCharacters] = useState(initialCharacters);
  // useState(initialCharacters) only ever consults that argument on the
  // very first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialCharacters, setPrevInitialCharacters] = useState(initialCharacters);
  if (initialCharacters !== prevInitialCharacters) {
    setPrevInitialCharacters(initialCharacters);
    setCharacters(initialCharacters);
  }
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const editingCharacter = editingId === null ? null : (characters.find((c) => c.id === editingId) ?? null);

  const filtered = useMemo(
    () =>
      filterAndSortCharacters(characters, {
        search,
        elementFilter,
        weaponTypeFilter,
        rarityFilter,
        ownershipFilter,
        sortKey,
        sortDirection,
      }),
    [characters, search, elementFilter, weaponTypeFilter, rarityFilter, ownershipFilter, sortKey, sortDirection]
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

  function handleUpdateProgression(characterId: number, input: UpdateCharacterProgressionInput) {
    const previous = characters;
    setCharacters((prev) => prev.map((character) => (character.id === characterId ? { ...character, ...input } : character)));
    setEditingId(null);

    startTransition(async () => {
      const result = await updateCharacterProgression(characterId, input).catch(() => ({ errors: {} }) as const);
      if ("errors" in result) setCharacters(previous);
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
          <option value="level">Sort: Level</option>
        </select>

        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
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

      <RarityFilterRow rarities={RARITIES} rarityFilter={rarityFilter} onToggle={toggleRarity} />

      <p className="text-sm text-gray-500">
        {filtered.length} character{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((character) => (
          <li key={character.id} className="group relative">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleToggleOwnership(character.id, !character.isOwned)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleToggleOwnership(character.id, !character.isOwned);
              }}
              aria-pressed={character.isOwned}
              className={`relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl border-8 text-left shadow ${
                character.isOwned ? "border-green-500" : "border-gray-600"
              } ${rarityGradientClasses(character.rarity)}`}
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
            </div>

            {character.isOwned && (
              <div
                className={`absolute bottom-1.5 right-1.5 z-20 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
                  editingId === character.id ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingId(character.id);
                  }}
                  aria-label={`Edit ${character.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-black"
                >
                  <PencilIcon />
                </button>
              </div>
            )}
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No characters match these filters.</p>}
      </ul>

      <Modal open={editingCharacter !== null} onClose={() => setEditingId(null)}>
        {editingCharacter && (
          <CharacterProgressionEditor
            key={editingCharacter.id}
            character={editingCharacter}
            onSave={(input) => handleUpdateProgression(editingCharacter.id, input)}
          />
        )}
      </Modal>
    </div>
  );
}
