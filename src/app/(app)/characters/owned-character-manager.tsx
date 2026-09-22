"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Element, WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { MIN_LEVEL, MAX_LEVEL, validAscensionPhasesForLevel } from "@/lib/ascension";
import {
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
import { CharacterCard } from "./character-card";
import { ElementFilterRow } from "./element-filter-row";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { filterAndSortOwnedCharacters, type OwnedCharacterItem, type OwnedSortKey, type SortDirection } from "./filter-sort";

export type { OwnedCharacterItem };

// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

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
  character: OwnedCharacterItem;
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
          {character.iconUrl && (
            <Image src={character.iconUrl} alt="" width={56} height={56} className="object-cover" />
          )}
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

export function OwnedCharacterManager({ initialOwnedCharacters }: { initialOwnedCharacters: OwnedCharacterItem[] }) {
  useRefreshOnBackNavigation();
  const [characters, setCharacters] = useState(initialOwnedCharacters);
  // useState(initialOwnedCharacters) only ever consults that argument on the
  // very first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialOwnedCharacters, setPrevInitialOwnedCharacters] = useState(initialOwnedCharacters);
  if (initialOwnedCharacters !== prevInitialOwnedCharacters) {
    setPrevInitialOwnedCharacters(initialOwnedCharacters);
    setCharacters(initialOwnedCharacters);
  }
  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const editingCharacter = editingId === null ? null : (characters.find((c) => c.id === editingId) ?? null);

  const filtered = useMemo(
    () =>
      filterAndSortOwnedCharacters(characters, {
        search,
        elementFilter,
        weaponTypeFilter,
        rarityFilter,
        sortKey,
        sortDirection,
      }),
    [characters, search, elementFilter, weaponTypeFilter, rarityFilter, sortKey, sortDirection]
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

  function handleUpdateProgression(characterId: number, input: UpdateCharacterProgressionInput) {
    const previous = characters;
    setCharacters((prev) =>
      prev.map((character) => (character.id === characterId ? { ...character, ...input } : character))
    );
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
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as OwnedSortKey)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
          <option value="level">Sort: Level</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
      </div>

      <ElementFilterRow elementFilter={elementFilter} onToggle={toggleElement} />
      <WeaponTypeFilterRow weaponTypeFilter={weaponTypeFilter} onToggle={toggleWeaponType} />
      <RarityFilterRow rarities={RARITIES} rarityFilter={rarityFilter} onToggle={toggleRarity} />

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
            level={character.level}
            constellation={character.constellation}
            onSelect={() => setEditingId(character.id)}
          />
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
