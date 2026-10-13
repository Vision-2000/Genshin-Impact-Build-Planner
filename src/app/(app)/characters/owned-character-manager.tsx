"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Element, WeaponType, TalentSlot } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import { HighlightedText } from "@/components/highlighted-text";
import { DiamondSelector } from "@/components/diamond-selector";
import { StatBonusList } from "@/components/stat-bonus-list";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  MAX_ASCENSION_PHASE,
  CHARACTER_EXTRA_LEVELS,
  validAscensionPhasesForCharacterLevel,
  characterMaxLevelForAscensionPhase,
  minLevelForAscensionPhase,
} from "@/lib/ascension";
import { formatStatValue } from "@/lib/stat-format";
import { roundHalfUp } from "@/lib/round";
import {
  computeCharacterMainStat,
  computeCharacterBonusStat,
  travelerStoryBuffBonus,
  travelerGenderGroup,
  travelerDisplayName,
} from "@/lib/character-scaling";
import { elementGlowClasses } from "@/lib/element-colors";
import { groupTalentAttributes } from "@/lib/talent-format";
import {
  updateCharacterProgression,
  getCharacterProgressionData,
  getTravelerElementSiblings,
  getOwnedCharacterProgression,
  type CharacterProgressionData,
} from "./actions";
import { computeTalentLevelBounds, type TalentLevelBounds, type UpdateCharacterProgressionInput } from "./schemas";
import { CharacterCard } from "./character-card";
import { ElementFilterRow } from "./element-filter-row";
import { ELEMENT_ICON_URL } from "./element-icons";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { filterAndSortOwnedCharacters, type OwnedCharacterItem, type OwnedSortKey, type SortDirection } from "./filter-sort";

export type { OwnedCharacterItem };

// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

const COMBAT_TALENT_SLOTS = new Set<TalentSlot>([TalentSlot.NormalAttack, TalentSlot.Skill, TalentSlot.Burst]);

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

function TooltipIcon({ iconUrl, alt, content }: { iconUrl: string | null; alt: string; content: ReactNode }) {
  return (
    <MouseFollowTooltip content={content}>
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gray-600 bg-black/30">
        {iconUrl && <Image src={iconUrl} alt={alt} width={30} height={30} />}
      </div>
    </MouseFollowTooltip>
  );
}

// Same toggle-to-step-down-by-one behavior as the shared ascension
// DiamondSelector, applied to the 6 constellation icons instead of plain
// diamonds -- lit icons use the character's own constellation art (from
// Constellation.iconUrl), unlit ones are grayscaled rather than swapped for
// a placeholder.
function ConstellationIcons({
  element,
  constellations,
  constellation,
  talentNames,
  onChange,
}: {
  element: Element;
  constellations: CharacterProgressionData["constellations"];
  constellation: number;
  talentNames: string[];
  onChange: (value: number) => void;
}) {
  const litClasses = elementGlowClasses(element);
  return (
    <div className="flex items-center gap-2.5">
      {constellations.map((c) => {
        const lit = c.number <= constellation;
        return (
          <MouseFollowTooltip
            key={c.number}
            content={
              <>
                <p className="text-base font-semibold text-yellow-100">
                  C{c.number} · {c.name}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-gray-300">
                  <HighlightedText text={c.description} talentNames={talentNames} />
                </p>
                <StatBonusList statBonuses={c.statBonuses} />
              </>
            }
          >
            <button
              type="button"
              aria-label={`Constellation ${c.number}`}
              aria-pressed={lit}
              onClick={() => onChange(c.number === constellation ? c.number - 1 : c.number)}
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 ${
                lit ? litClasses : "border-gray-600 bg-black/30 opacity-50 grayscale"
              }`}
            >
              {c.iconUrl && <Image src={c.iconUrl} alt={c.name} width={30} height={30} />}
            </button>
          </MouseFollowTooltip>
        );
      })}
    </div>
  );
}

// Lets the editor switch which of a Traveler's 7 elemental forms it's
// viewing/editing -- same badge-row layout as ElementFilterRow, but the
// unactivated state is colourless (grayscale), matching how an unlit
// ConstellationIcons badge looks, rather than ElementFilterRow's ring
// highlight (that's a multi-select filter; this is a single pick).
function TravelerElementPicker({
  siblings,
  selectedElement,
  onSelect,
}: {
  siblings: { id: number; element: Element; name: string }[];
  selectedElement: Element;
  onSelect: (sibling: { id: number; element: Element; name: string }) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {siblings.map((sibling) => {
        const selected = sibling.element === selectedElement;
        return (
          <button
            key={sibling.id}
            type="button"
            aria-label={sibling.element}
            aria-pressed={selected}
            title={sibling.element}
            onClick={() => onSelect(sibling)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 p-1.5 ${
              selected ? elementGlowClasses(sibling.element) : "border-gray-600 bg-black/30 opacity-50 grayscale"
            }`}
          >
            <Image src={ELEMENT_ICON_URL[sibling.element]} alt={sibling.element} width={22} height={22} />
          </button>
        );
      })}
    </div>
  );
}

// One combat talent's icon (hover for its description + the attribute
// values at the currently-selected level) plus its existing level slider.
// TalentAttribute.values is indexed from level 1 (index 0), same convention
// documented on the schema -- clamped to the array's own length since a
// constellation boost can push the level past 10 up toward the 15 genshin-db
// stores.
function CombatTalentRow({
  talent,
  level,
  bounds,
  talentNames,
  onChange,
}: {
  talent: CharacterProgressionData["talents"][number];
  level: number;
  bounds: TalentLevelBounds;
  talentNames: string[];
  onChange: (level: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <TooltipIcon
        iconUrl={talent.iconUrl}
        alt={talent.name}
        content={
          <>
            <p className="text-base font-semibold text-yellow-100">{talent.name}</p>
            <p className="mt-1.5 whitespace-pre-line text-gray-300">
              <HighlightedText text={talent.description} talentNames={talentNames} />
            </p>
            {talent.attributes.length > 0 && (
              <>
                <hr className="mt-2 border-gray-700" />
                <ul className="mt-2 space-y-1 text-gray-300">
                  {groupTalentAttributes(talent.attributes, level).map((g) => (
                    <li key={g.label}>
                      <span className="font-medium text-yellow-100">{g.label}</span>: {g.display}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        }
      />
      <input
        type="range"
        min={bounds.min}
        max={bounds.max}
        value={level}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-32"
      />
      <span className="w-8 text-gray-400">{level}</span>
    </div>
  );
}

// Passives have no level to invest in -- just an icon with a hover tooltip
// (description, plus its stat bonus if it has one; most don't, see
// TalentStatBonus's schema comment).
function PassiveTalentIcon({ talent, talentNames }: { talent: CharacterProgressionData["talents"][number]; talentNames: string[] }) {
  return (
    <TooltipIcon
      iconUrl={talent.iconUrl}
      alt={talent.name}
      content={
        <>
          <p className="text-base font-semibold text-yellow-100">{talent.name}</p>
          <p className="mt-1.5 whitespace-pre-line text-gray-300">
            <HighlightedText text={talent.description} talentNames={talentNames} />
          </p>
          <StatBonusList statBonuses={talent.statBonuses} />
        </>
      }
    />
  );
}

// Talent icons/sliders + passive icons, split into its own component so it
// only ever renders once `data` (fetched lazily by the parent) is loaded --
// keeps the parent from juggling null checks on every field it reads off it.
function TalentsSection({
  data,
  constellation,
  normalAttackLevel,
  skillLevel,
  burstLevel,
  onChangeNormalAttackLevel,
  onChangeSkillLevel,
  onChangeBurstLevel,
}: {
  data: CharacterProgressionData;
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
  onChangeNormalAttackLevel: (level: number) => void;
  onChangeSkillLevel: (level: number) => void;
  onChangeBurstLevel: (level: number) => void;
}) {
  const bounds = computeTalentLevelBounds(constellation, data.constellations);
  const talentBySlot = new Map(data.talents.map((t) => [t.slot, t]));
  const passives = data.talents.filter((t) => !COMBAT_TALENT_SLOTS.has(t.slot));
  // Every one of the character's own talent names, not just the current
  // talent's -- a description commonly references another talent by name,
  // not always wrapped in genshin-db's own ** markers (see HighlightedText's
  // own comment).
  const talentNames = data.talents.map((t) => t.name);

  return (
    <div className="space-y-2">
      {talentBySlot.get(TalentSlot.NormalAttack) && (
        <CombatTalentRow
          talent={talentBySlot.get(TalentSlot.NormalAttack)!}
          level={normalAttackLevel}
          bounds={bounds.normalAttackLevel}
          talentNames={talentNames}
          onChange={onChangeNormalAttackLevel}
        />
      )}
      {talentBySlot.get(TalentSlot.Skill) && (
        <CombatTalentRow
          talent={talentBySlot.get(TalentSlot.Skill)!}
          level={skillLevel}
          bounds={bounds.skillLevel}
          talentNames={talentNames}
          onChange={onChangeSkillLevel}
        />
      )}
      {talentBySlot.get(TalentSlot.Burst) && (
        <CombatTalentRow
          talent={talentBySlot.get(TalentSlot.Burst)!}
          level={burstLevel}
          bounds={bounds.burstLevel}
          talentNames={talentNames}
          onChange={onChangeBurstLevel}
        />
      )}
      {passives.length > 0 && (
        <div className="flex items-center gap-2.5 pt-1">
          {passives.map((t) => (
            <PassiveTalentIcon key={t.id} talent={t} talentNames={talentNames} />
          ))}
        </div>
      )}
    </div>
  );
}

function BaseStatsSection({
  name,
  data,
  level,
  ascensionPhase,
}: {
  name: string;
  data: CharacterProgressionData;
  level: number;
  ascensionPhase: number;
}) {
  // Traveler's permanent story-quest buff is flat and NOT part of the level
  // curve -- added after computeCharacterMainStat, never folded into its
  // base/maxAscension inputs. See travelerStoryBuffBonus in
  // @/lib/character-scaling.
  const hp =
    computeCharacterMainStat(data.baseHp, data.maxAscensionHp, data.scalingRarity, level, ascensionPhase, "hp") +
    travelerStoryBuffBonus(name, "hp");
  const attack =
    computeCharacterMainStat(data.baseAttack, data.maxAscensionAttack, data.scalingRarity, level, ascensionPhase, "attack") +
    travelerStoryBuffBonus(name, "attack");
  const defense = computeCharacterMainStat(data.baseDefense, data.maxAscensionDefense, data.scalingRarity, level, ascensionPhase, "defense");
  const bonusStat = data.ascensionStatName
    ? computeCharacterBonusStat(data.ascensionStatName, data.scalingRarity, ascensionPhase)
    : null;
  // The ascension-stat bonus and the flat EM floor are two independent
  // sources -- most characters have one or neither, but a character whose
  // own ascension stat IS Elemental Mastery (e.g. Lauma) has both, additive.
  // See Character.baseElementalMastery in schema.prisma.
  const isAscensionStatElementalMastery = data.ascensionStatName === "Elemental Mastery";
  const totalElementalMastery =
    data.baseElementalMastery + (isAscensionStatElementalMastery ? bonusStat ?? 0 : 0) + travelerStoryBuffBonus(name, "elementalMastery");

  return (
    <div className="space-y-1 rounded border p-2 text-sm">
      <p className="font-medium">Stats</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-500 dark:text-gray-300">
        <li>Base HP: {roundHalfUp(hp, 0)}</li>
        <li>Base ATK: {roundHalfUp(attack, 0)}</li>
        <li>Base DEF: {roundHalfUp(defense, 0)}</li>
        {data.ascensionStatName && bonusStat !== null && !isAscensionStatElementalMastery && (
          <li>
            {data.ascensionStatName}: {formatStatValue(data.ascensionStatName, bonusStat)}
          </li>
        )}
        {totalElementalMastery > 0 && (
          <li>Elemental Mastery: {formatStatValue("Elemental Mastery", totalElementalMastery)}</li>
        )}
      </ul>
    </div>
  );
}

// Modal body for editing level/ascension/constellation/talent levels, plus
// (once data loads) hover detail on every constellation/talent and the
// character's base stats at the currently-selected level+ascension.
// Ascension is constrained by level (see WeaponProgressionEditor's
// counterpart in weapons/owned-weapon-manager.tsx for the same pattern) --
// but here that relationship runs both ways, since clicking an ascension
// diamond also has to pull the level into that phase's valid range (see
// handleAscensionPhaseChange). Fetched lazily here rather than bundled into
// the main roster query -- only the character currently being edited needs
// this, and it's a much heavier query than the roster's per-card summary.
function CharacterProgressionEditor({
  character,
  preferredTravelerElement,
  onSave,
}: {
  character: OwnedCharacterItem;
  // Which element to auto-select for a Traveler, instead of always landing
  // on whichever happened to be the representative row (see
  // collapseTravelerOwnedRows) -- the parent tracks this across the whole
  // page session, updated whenever a Traveler edit is actually saved.
  // Ignored for a non-Traveler.
  preferredTravelerElement: Element;
  onSave: (characterId: number, input: UpdateCharacterProgressionInput) => void;
}) {
  // Which elemental form is actually being viewed/edited right now -- for a
  // non-Traveler this never changes from `character`'s own id/element; for
  // a Traveler, the element picker below can switch it to any of the other
  // 6. level/ascensionPhase stay as one shared piece of state regardless
  // (see their own comment below); constellation/talent levels get
  // re-fetched per element on a switch, since those genuinely differ.
  const [selectedCharacterId, setSelectedCharacterId] = useState(character.id);
  const [selectedElement, setSelectedElement] = useState(character.element);
  const [selectedName, setSelectedName] = useState(character.name);
  const [siblings, setSiblings] = useState<{ id: number; element: Element; name: string }[] | null>(null);

  // Level and ascension phase belong to the Traveler protagonist as a
  // whole (see travelerGenderGroup in @/lib/character-scaling) -- switching
  // which element is selected keeps whatever's currently here, in-progress
  // edits included, rather than re-fetching it per element.
  const [level, setLevel] = useState(character.level);
  const [ascensionPhase, setAscensionPhase] = useState(character.ascensionPhase);
  const [constellation, setConstellation] = useState(character.constellation);
  const [normalAttackLevel, setNormalAttackLevel] = useState(character.normalAttackLevel);
  const [skillLevel, setSkillLevel] = useState(character.skillLevel);
  const [burstLevel, setBurstLevel] = useState(character.burstLevel);
  const [data, setData] = useState<CharacterProgressionData | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTravelerElementSiblings(character.id).then((result) => {
      if (cancelled) return;
      setSiblings(result);
      // Land on the preferred element instead of the representative row
      // that happened to open, if they differ -- same effect as the user
      // immediately clicking that badge themselves.
      const preferred = result?.find((sibling) => sibling.element === preferredTravelerElement);
      if (preferred && preferred.id !== character.id) handleSelectElement(preferred);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preferredTravelerElement is only meant to apply once, at the mount that opened this particular character; re-running this for a later change would re-fetch and re-apply it mid-edit, which isn't the intent.
  }, [character.id]);

  useEffect(() => {
    let cancelled = false;
    getCharacterProgressionData(selectedCharacterId).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCharacterId]);

  // Switching to a different elemental form of the same Traveler: swap in
  // that element's own constellation/talent levels (genuinely per-element),
  // but leave level/ascensionPhase alone -- they're shared, so whatever's
  // currently set already applies to the newly-selected element too.
  function handleSelectElement(sibling: { id: number; element: Element; name: string }) {
    setSelectedCharacterId(sibling.id);
    setSelectedElement(sibling.element);
    setSelectedName(sibling.name);
    getOwnedCharacterProgression(sibling.id).then((progression) => {
      setConstellation(progression.constellation);
      setNormalAttackLevel(progression.normalAttackLevel);
      setSkillLevel(progression.skillLevel);
      setBurstLevel(progression.burstLevel);
    });
  }

  const talentLevelBounds = data ? computeTalentLevelBounds(constellation, data.constellations) : null;

  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    const phases = validAscensionPhasesForCharacterLevel(newLevel);
    if (!phases.includes(ascensionPhase)) {
      setAscensionPhase(phases[phases.length - 1]);
    }
  }

  // The inverse of handleLevelChange: clicking a diamond sets the phase
  // directly, then pulls the level into whatever range is actually possible
  // at that phase (e.g. level 1 -> 20 when phase 1 is clicked; level 41 ->
  // 40 if phase 1, capped at 40, is clicked) rather than leaving a now-
  // invalid level/phase pair on screen. characterMaxLevelForAscensionPhase
  // (not the weapon-shared maxLevelForAscensionPhase) so leaving phase 6
  // correctly clamps 95/100 down, and returning to it allows them back in.
  function handleAscensionPhaseChange(newPhase: number) {
    setAscensionPhase(newPhase);
    const min = minLevelForAscensionPhase(newPhase);
    const max = characterMaxLevelForAscensionPhase(newPhase);
    setLevel((prev) => Math.min(max, Math.max(min, prev)));
  }

  function handleConstellationChange(newConstellation: number) {
    if (!data) {
      // Bounds aren't known yet -- shouldn't be reachable since the
      // constellation icons only render once data has loaded, but keep this
      // safe rather than silently dropping the new value.
      setConstellation(newConstellation);
      return;
    }
    const oldBounds = computeTalentLevelBounds(constellation, data.constellations);
    const newBounds = computeTalentLevelBounds(newConstellation, data.constellations);
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
          <p className="text-lg font-medium">{travelerDisplayName(selectedName)}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Image
              src={ELEMENT_ICON_URL[selectedElement]}
              alt={selectedElement}
              title={selectedElement}
              width={20}
              height={20}
            />
            <Image
              src={WEAPON_TYPE_ICON_URL[character.weaponType]}
              alt={character.weaponType}
              title={character.weaponType}
              width={20}
              height={20}
            />
          </div>
        </div>
      </div>

      {siblings && (
        <div className="space-y-1">
          <p className="text-sm">Element</p>
          <TravelerElementPicker siblings={siblings} selectedElement={selectedElement} onSelect={handleSelectElement} />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        Level
        <input
          type="range"
          min={MIN_LEVEL}
          max={MAX_LEVEL}
          // Clamped for display only -- a plain range input can't represent
          // the 90 -> 95/100 jump (91-94 and 96-99 don't exist in-game), so
          // those two levels are reached via the buttons below instead;
          // dragging the slider at all naturally returns to the continuous
          // 1-90 range via the onChange below.
          value={Math.min(level, MAX_LEVEL)}
          onChange={(event) => handleLevelChange(Number(event.target.value))}
          className="-mt-1 w-32"
        />
        <span className="w-14 text-gray-400">
          {level}/{characterMaxLevelForAscensionPhase(ascensionPhase)}
        </span>
        {ascensionPhase === MAX_ASCENSION_PHASE && (
          <div className="flex gap-1">
            {CHARACTER_EXTRA_LEVELS.map((extraLevel) => (
              <button
                key={extraLevel}
                type="button"
                onClick={() => handleLevelChange(extraLevel)}
                className={`rounded border px-1.5 py-0.5 text-xs ${
                  level === extraLevel
                    ? "border-amber-400 bg-amber-400/20 text-amber-400"
                    : "border-gray-600 text-gray-400"
                }`}
              >
                {extraLevel}
              </button>
            ))}
          </div>
        )}
      </label>

      <div className="space-y-1">
        <p className="text-sm">Ascension</p>
        <DiamondSelector
          count={MAX_ASCENSION_PHASE}
          value={ascensionPhase}
          onChange={handleAscensionPhaseChange}
          litClassName="border-amber-400 bg-amber-400"
          ariaLabel={(phase) => `Ascension phase ${phase}`}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm">Constellation</p>
        {!data ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <ConstellationIcons
            element={selectedElement}
            constellations={data.constellations}
            constellation={constellation}
            talentNames={data.talents.map((t) => t.name)}
            onChange={handleConstellationChange}
          />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Talents</p>
        {!data ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <TalentsSection
            data={data}
            constellation={constellation}
            normalAttackLevel={normalAttackLevel}
            skillLevel={skillLevel}
            burstLevel={burstLevel}
            onChangeNormalAttackLevel={setNormalAttackLevel}
            onChangeSkillLevel={setSkillLevel}
            onChangeBurstLevel={setBurstLevel}
          />
        )}
      </div>

      {data && <BaseStatsSection name={selectedName} data={data} level={level} ascensionPhase={ascensionPhase} />}

      <div className="flex justify-end border-t pt-3">
        <button
          type="button"
          disabled={!talentLevelBounds}
          onClick={() =>
            onSave(selectedCharacterId, { level, ascensionPhase, constellation, normalAttackLevel, skillLevel, burstLevel })
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
  // Which Traveler element the progression editor should open to -- Pyro by
  // default, then whatever element was actually saved last, for the rest of
  // this page session (not persisted beyond it). See
  // CharacterProgressionEditor's preferredTravelerElement prop.
  const [lastTravelerElement, setLastTravelerElement] = useState<Element>(Element.Pyro);
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

  // characterId here is whichever elemental form the editor's picker had
  // selected at Save time -- for a Traveler this often isn't the
  // representative row this list actually displays (see
  // collapseTravelerOwnedRows), which may not even be present in `characters`.
  // The representative's own card still needs updating when that happens,
  // since level/ascensionPhase are shared across every element of the same
  // gender -- but its genuinely per-element fields (constellation/talent
  // levels) belong to whichever element was actually edited, not to the
  // representative, so those are left untouched on every other row.
  function handleUpdateProgression(characterId: number, input: UpdateCharacterProgressionInput) {
    const previous = characters;
    const editedCharacter = characters.find((character) => character.id === characterId);
    const genderGroup = editedCharacter ? travelerGenderGroup(editedCharacter.name) : null;
    if (genderGroup && editedCharacter) setLastTravelerElement(editedCharacter.element);

    setCharacters((prev) =>
      prev.map((character) => {
        if (character.id === characterId) return { ...character, ...input };
        if (genderGroup && travelerGenderGroup(character.name) === genderGroup) {
          return { ...character, level: input.level, ascensionPhase: input.ascensionPhase };
        }
        return character;
      })
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

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {filtered.length} character{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((character) => (
          <CharacterCard
            key={character.id}
            name={character.name}
            element={character.isTravelerGroup ? undefined : character.element}
            weaponType={character.weaponType}
            rarity={character.rarity}
            iconUrl={character.iconUrl}
            progression={{
              level: character.level,
              ascensionPhase: character.ascensionPhase,
              constellation: character.constellation,
              normalAttackLevel: character.normalAttackLevel,
              skillLevel: character.skillLevel,
              burstLevel: character.burstLevel,
            }}
            onSelect={() => setEditingId(character.id)}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No characters match these filters.</p>}
      </ul>

      <Modal open={editingCharacter !== null} onClose={() => setEditingId(null)} maxWidthClassName="max-w-xl">
        {editingCharacter && (
          <CharacterProgressionEditor
            key={editingCharacter.id}
            character={editingCharacter}
            preferredTravelerElement={lastTravelerElement}
            onSave={handleUpdateProgression}
          />
        )}
      </Modal>
    </div>
  );
}
