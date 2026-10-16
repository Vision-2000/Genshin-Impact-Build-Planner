"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Element, WeaponType, TalentSlot } from "@/generated/prisma/enums";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import { TaggedText } from "@/components/tagged-text";
import { SplashImage } from "@/components/splash-image";
import { DiamondSelector } from "@/components/diamond-selector";
import { StatBonusList } from "@/components/stat-bonus-list";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  MAX_ASCENSION_PHASE,
  CHARACTER_EXTRA_LEVELS,
  CHARACTER_MAX_LEVEL,
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
import { elementGlowClasses, elementBackgroundClass } from "@/lib/element-colors";
import { groupTalentAttributes } from "@/lib/talent-format";
import {
  updateCharacterProgression,
  getCharacterProgressionData,
  getTravelerElementSiblings,
  getOwnedCharacterProgression,
  type CharacterProgressionData,
  type TravelerElementSibling,
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
  onChange,
}: {
  element: Element;
  constellations: CharacterProgressionData["constellations"];
  constellation: number;
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
                  <TaggedText text={c.description} />
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
  siblings: TravelerElementSibling[];
  selectedElement: Element;
  onSelect: (sibling: TravelerElementSibling) => void;
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
  onChange,
}: {
  talent: CharacterProgressionData["talents"][number];
  level: number;
  bounds: TalentLevelBounds;
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
              <TaggedText text={talent.description} />
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
      <span className="w-8">{level}</span>
    </div>
  );
}

// Passives have no level to invest in -- just an icon with a hover tooltip
// (description, plus its stat bonus if it has one; most don't, see
// TalentStatBonus's schema comment).
function PassiveTalentIcon({ talent }: { talent: CharacterProgressionData["talents"][number] }) {
  return (
    <TooltipIcon
      iconUrl={talent.iconUrl}
      alt={talent.name}
      content={
        <>
          <p className="text-base font-semibold text-yellow-100">{talent.name}</p>
          <p className="mt-1.5 whitespace-pre-line text-gray-300">
            <TaggedText text={talent.description} />
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

  return (
    <div className="space-y-2">
      {talentBySlot.get(TalentSlot.NormalAttack) && (
        <CombatTalentRow
          talent={talentBySlot.get(TalentSlot.NormalAttack)!}
          level={normalAttackLevel}
          bounds={bounds.normalAttackLevel}
          onChange={onChangeNormalAttackLevel}
        />
      )}
      {talentBySlot.get(TalentSlot.Skill) && (
        <CombatTalentRow
          talent={talentBySlot.get(TalentSlot.Skill)!}
          level={skillLevel}
          bounds={bounds.skillLevel}
          onChange={onChangeSkillLevel}
        />
      )}
      {talentBySlot.get(TalentSlot.Burst) && (
        <CombatTalentRow
          talent={talentBySlot.get(TalentSlot.Burst)!}
          level={burstLevel}
          bounds={bounds.burstLevel}
          onChange={onChangeBurstLevel}
        />
      )}
      {passives.length > 0 && (
        <div className="flex items-center gap-2.5 pt-1">
          {passives.map((t) => (
            <PassiveTalentIcon key={t.id} talent={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// A grid cell that never resizes as `current` changes: `ghost` (normal
// flow, invisible) is what actually determines the cell's max-content
// width, while `current` (absolutely positioned over it) is what's
// actually seen. Pass the worst-case text this cell could ever show as
// `ghost` and the column is pre-sized for it from the start -- no reflow
// as the user drags a slider, since the space was already reserved for
// something at least as wide as any value that could land there.
function StatLine({ current, ghost }: { current: string; ghost: string }) {
  return (
    <li className="relative">
      <span className="invisible">{ghost}</span>
      <span className="absolute inset-0">{current}</span>
    </li>
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
  // The ascension-stat bonus, the flat EM floor, and Traveler's own flat
  // story-quest EM buff are three independent sources -- most characters
  // have none or one, but a character whose own ascension stat IS
  // Elemental Mastery (e.g. Lauma) has both the first two, additive. See
  // Character.baseElementalMastery in schema.prisma.
  const isAscensionStatElementalMastery = data.ascensionStatName === "Elemental Mastery";
  const travelerElementalMasteryBuff = travelerStoryBuffBonus(name, "elementalMastery");
  const totalElementalMastery =
    data.baseElementalMastery + (isAscensionStatElementalMastery ? bonusStat ?? 0 : 0) + travelerElementalMasteryBuff;

  // Worst-case equivalents of every value above -- level 100, max ascension
  // phase. computeCharacterMainStat/computeCharacterBonusStat are both
  // monotonically increasing in level and ascension phase (verified against
  // the formula sheet, see character-scaling.ts), so this combination is
  // always this character's single largest possible reading for every stat
  // below, regardless of what level/phase they're actually sitting at.
  // These never feed the visible numbers -- only StatLine's invisible
  // ghost text, to size each column for the biggest value it could ever
  // need to hold.
  const maxHp =
    computeCharacterMainStat(data.baseHp, data.maxAscensionHp, data.scalingRarity, CHARACTER_MAX_LEVEL, MAX_ASCENSION_PHASE, "hp") +
    travelerStoryBuffBonus(name, "hp");
  const maxAttack =
    computeCharacterMainStat(data.baseAttack, data.maxAscensionAttack, data.scalingRarity, CHARACTER_MAX_LEVEL, MAX_ASCENSION_PHASE, "attack") +
    travelerStoryBuffBonus(name, "attack");
  const maxDefense = computeCharacterMainStat(
    data.baseDefense,
    data.maxAscensionDefense,
    data.scalingRarity,
    CHARACTER_MAX_LEVEL,
    MAX_ASCENSION_PHASE,
    "defense"
  );
  const maxBonusStat = data.ascensionStatName
    ? computeCharacterBonusStat(data.ascensionStatName, data.scalingRarity, MAX_ASCENSION_PHASE)
    : null;
  const maxTotalElementalMastery =
    data.baseElementalMastery + (isAscensionStatElementalMastery ? maxBonusStat ?? 0 : 0) + travelerElementalMasteryBuff;

  return (
    // No explicit width -- plain width:auto already fills 100% of the
    // w-fit wrapper by default for a normal block child (an explicit
    // w-full was redundant all along), and -mr-9 then extends an
    // auto-width box the same way it extends the Save button's divider
    // row (same unset width there, see its own comment): the auto-width
    // formula solves for a WIDER box to compensate for the negative
    // margin. An explicit width (w-full) breaks exactly this -- fixed at
    // 100% of its parent regardless of margin, a negative margin on it
    // instead shrinks this box's own contribution to the wrapper's
    // fit-content calculation, which (since this box was often the
    // widest contributor) shrank the wrapper itself, and this box right
    // along with it -- the bug just fixed. This box's own intrinsic
    // width still comes from StatLine's invisible ghost text below (this
    // character's own worst-case values, not whatever's currently
    // displayed), so it still never resizes mid-interaction.
    <div className="-mr-9 rounded border bg-black p-3 text-sm">
      {/* max-content columns, not 1fr/1fr -- sizes each column to exactly
          what its own longest line needs. Combined with StatLine's ghost
          text above, each column is sized once, for this character's own
          worst case -- never off whatever the slider currently reads.
          justify-around (not a fixed gap-x) distributes whatever's left
          over, once the box's own width is set by something else entirely
          (see the box's own comment), giving each column equal space on
          BOTH its sides -- which makes the shared middle gap (between the
          two columns, each contributing its own share) come out exactly
          double the two edge gaps (before the left column, after the
          right one), a 1:2:1 split rather than justify-evenly's 1:1:1.
          w-full is load-bearing here specifically -- unlike a plain block,
          a grid container's width:auto shrink-wraps to its tracks' own
          content size instead of filling its parent, so without this
          there's no extra space inside the grid itself to distribute,
          even though the box around it is already the right width.
          "Stats" moved inside the grid as its own row, rather than a
          separate <p> above it -- that's what makes it line up with the
          left column: justify-around's "before" gap shifts the left
          column's actual position off the box's own padding edge, and
          only another grid item sharing that same column tracking picks
          the shift up automatically. A plain sibling outside the grid has
          no way to know what that gap currently is. Deliberately NOT
          col-span-2 -- a spanning item's own content size feeds into BOTH
          columns' track-sizing, so for a character with short enough stat
          values, "Stats" itself could need more width than the two real
          columns combined, growing them to fit it and eating the slack
          justify-around needs to distribute. An explicit empty cell next
          to it reserves column 2 for the header row without "Stats"
          influencing that column's sizing at all. */}
      <ul className="grid w-full grid-cols-[max-content_max-content] justify-around gap-y-0.5 whitespace-nowrap">
        <li className="font-medium text-foreground">Stats</li>
        <li aria-hidden="true" />
        <StatLine current={`Base HP: ${roundHalfUp(hp, 0)}`} ghost={`Base HP: ${roundHalfUp(maxHp, 0)}`} />
        <StatLine current={`Base ATK: ${roundHalfUp(attack, 0)}`} ghost={`Base ATK: ${roundHalfUp(maxAttack, 0)}`} />
        <StatLine current={`Base DEF: ${roundHalfUp(defense, 0)}`} ghost={`Base DEF: ${roundHalfUp(maxDefense, 0)}`} />
        {data.ascensionStatName && bonusStat !== null && maxBonusStat !== null && !isAscensionStatElementalMastery && (
          <StatLine
            current={`${data.ascensionStatName}: ${formatStatValue(data.ascensionStatName, bonusStat)}`}
            ghost={`${data.ascensionStatName}: ${formatStatValue(data.ascensionStatName, maxBonusStat)}`}
          />
        )}
        {/* Shown whenever EM is actually part of this character's kit --
            as their ascension stat (e.g. Mizuki), a flat floor
            (Lauma/Nefer), or Traveler's own flat story-quest buff -- not
            gated on the current total being nonzero, same as the
            ascension-stat line above: a Mizuki at phase 0 should still
            show "Elemental Mastery: 0", not hide the row until she's
            ascended past phase 0. */}
        {(isAscensionStatElementalMastery || data.baseElementalMastery > 0 || travelerElementalMasteryBuff > 0) && (
          <StatLine
            current={`Elemental Mastery: ${formatStatValue("Elemental Mastery", totalElementalMastery)}`}
            ghost={`Elemental Mastery: ${formatStatValue("Elemental Mastery", maxTotalElementalMastery)}`}
          />
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
  const [selectedSplashUrl, setSelectedSplashUrl] = useState(character.splashUrl);
  const [siblings, setSiblings] = useState<TravelerElementSibling[] | null>(null);

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
  function handleSelectElement(sibling: TravelerElementSibling) {
    setSelectedCharacterId(sibling.id);
    setSelectedElement(sibling.element);
    setSelectedName(sibling.name);
    setSelectedSplashUrl(sibling.splashUrl);
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
    // -m-5 bleeds back out over the Modal's own padding so this fills the
    // whole rounded panel, not just the content area inside it. Splash art
    // stands in for the small portrait icon the header used to show (its
    // own column, stretching to match whatever height the form ends up
    // needing); the panel's background tints to the selected element's own
    // color, visible wherever the art doesn't fully cover (letterboxing,
    // or no splash art at all). text-white is forced site-wide rather than
    // per-element, since nearly every label here otherwise relies on the
    // default (theme-dependent) foreground color, which isn't reliably
    // legible over a dark element-tinted panel. The form column centers
    // its content vertically (flex-col justify-center) rather than sitting
    // pinned to the top, since the image column is frequently taller than
    // the form actually needs -- centering spreads that slack above and
    // below instead of leaving it all as dead space underneath.
    <div className="relative -m-5 flex flex-col overflow-hidden rounded-lg text-white sm:flex-row">
      {/* Name/element/weapon live inside the splash-art column specifically
          (stacked above the art itself), not spanning the whole panel --
          this reserves space only within that column, leaving the form
          column's own top untouched. Element tint lives on this column
          alone now, not the whole panel -- the form column is plain black
          instead, a deliberate design choice separate from the element
          colors themselves. */}
      <div className={`relative flex h-64 w-full shrink-0 flex-col sm:h-auto sm:w-96 ${elementBackgroundClass(selectedElement)}`}>
        <div className="px-3 pt-3">
          <p className="pl-2 text-2xl font-medium">{travelerDisplayName(selectedName)}</p>
          <div className="mt-1 flex items-center gap-2 pl-2">
            <Image
              src={ELEMENT_ICON_URL[selectedElement]}
              alt={selectedElement}
              title={selectedElement}
              width={26}
              height={26}
            />
            <Image
              src={WEAPON_TYPE_ICON_URL[character.weaponType]}
              alt={character.weaponType}
              title={character.weaponType}
              width={32}
              height={32}
            />
            {/* Rarity, as exactly `rarity` stars -- not interactive, same
                reasoning as before, just without DiamondSelector's unlit
                remainder: rarity has no fixed max slot count to pad out to. */}
            <div className="flex items-center gap-0.5" aria-label={`Rarity ${character.rarity}`}>
              {Array.from({ length: character.rarity }, (_, i) => i).map((i) => (
                <span key={i} className="text-xl text-amber-400">
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {selectedSplashUrl && (
            // sizes is deliberately NOT matched to this column's actual
            // width -- Next only sizes the optimized image by width,
            // with no way to account for object-cover's vertical crop. Most
            // characters' source splash art is a wide landscape frame (seen
            // against Traveler's own tall portrait one), so a width-matched
            // resize comes out too short and then gets stretched vertically
            // to fill this tall column, which is what was actually blurry.
            // "100vw" asks for a much larger variant regardless of the
            // column's real width -- fine here since only one is ever shown
            // on screen at a time.
            //
            // object-contain for Traveler specifically, not object-cover --
            // their source (1031x1200) is narrower than this column usually
            // ends up being once it stretches to match the form's height, so
            // object-cover (which scales up until BOTH dimensions are
            // covered) was cropping their sides to make the height fit,
            // cutting off part of the dress/sword that the raw source image
            // actually has. object-contain scales down until the WHOLE image
            // fits instead (letterboxing top/bottom rather than cropping
            // anything), which also naturally renders Traveler smaller within
            // the frame -- matching the earlier ask that every other
            // character already satisfies by virtue of their own source
            // being a wide landscape frame object-cover crops down to a
            // narrow slice, rather than needing a separate size tweak.
            //
            // key={selectedSplashUrl} remounts SplashImage fresh whenever
            // the url changes (opening a different character, or switching
            // a Traveler's element), so its own "loaded" state always
            // starts over instead of carrying over true from whatever was
            // shown before.
            <SplashImage
              key={selectedSplashUrl}
              src={selectedSplashUrl}
              objectFit={travelerGenderGroup(selectedName) ? "contain" : "cover"}
            />
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center bg-primary-page p-5 pr-14">
      {/* w-fit here (not on the outer p-5 div) -- shrinks this block to
          whichever row is actually widest (the stats box or the level-100
          button, depending on the character), so the Save button's row
          (w-full, justify-end below) lines up with THAT edge instead of
          the column's full available width. The outer div's pr-14 is the
          remaining gap between the widest row and the modal's actual edge
          -- NOT just cosmetic now that Modal's fitContent shrinks the
          panel to match: the close button sits at right-2 (8px) with its
          own w-10 (40px), 48px of real reserved space from the panel's
          edge, which a smaller pr directly overlapped once the panel
          stopped being wider than its content. */}
      <div className="w-fit space-y-4">
      {siblings && (
        <div className="space-y-1">
          <p className="text-sm">Element</p>
          <TravelerElementPicker siblings={siblings} selectedElement={selectedElement} onSelect={handleSelectElement} />
        </div>
      )}

      {/* Only the word itself is the <label> (tied to the slider via
          htmlFor/id) -- it used to wrap the whole row, which made the
          slider/buttons/counter all implicitly "belong" to one label.
          Browsers give a label's own hover/click affordance to its
          associated control across its ENTIRE area, so hovering the extra-
          level buttons below was visually highlighting the slider as if it
          were being hovered directly, even though the two don't overlap.
          A plain sibling div for the rest avoids that. */}
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="character-level-slider">Level</label>
        <input
          id="character-level-slider"
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
        {/* Deliberately NOT characterMaxLevelForAscensionPhase(ascensionPhase)
            -- that returns 100 for the whole of phase 6, so reaching level
            90 by sliding (ascending into phase 6 along the way) would show
            "90/100" immediately, implying 95/100 were already reached. At
            95 or 100 there's nowhere further to go within that same level,
            so the cap just mirrors the level itself (95/95, 100/100). */}
        <span className="w-14">
          {level}/{level > MAX_LEVEL ? level : MAX_LEVEL}
        </span>
        {/* Always rendered (reserving the row's width/height) rather than
            conditionally mounted -- mounting it only at phase 6 made the
            Level row (and via flex stretch, the whole editor and the
            splash art alongside it) visibly grow the moment you reached
            it. invisible keeps the space without showing or allowing
            clicks on it below phase 6. */}
        <div className={`flex items-center gap-1 ${ascensionPhase === MAX_ASCENSION_PHASE ? "" : "invisible"}`}>
          {CHARACTER_EXTRA_LEVELS.map((extraLevel) => (
            <button
              key={extraLevel}
              type="button"
              // Clicking an already-selected extra level reverts to 90,
              // the same "click the lit one to step back down" pattern
              // DiamondSelector uses -- 90 specifically (not the other
              // extra level), since that's the normal slider's own ceiling.
              onClick={() => handleLevelChange(level === extraLevel ? MAX_LEVEL : extraLevel)}
              // cursor-pointer explicitly -- <button> defaults to
              // cursor: default in the browser UA stylesheet (unlike
              // anchors), so without this these looked inert. Both states
              // get their own hover feedback (the selected one a touch
              // brighter, not just the unselected one) so hovering an
              // already-active button still visibly reacts, same
              // expectation as any other button here. Selection is
              // conveyed by the border/fill alone now -- the digit itself
              // stays the same plain text color as everything else in the
              // editor, not its own amber/gray.
              //
              // -mt-1 nudges the whole button box up to line up with the
              // level counter span beside it -- box position confirmed
              // correct with plain symmetric py-0.5, so padding here stays
              // untouched; only the digit INSIDE gets nudged (see the span
              // below), since it's specifically the glyph that still sits
              // high, not the box itself.
              className={`-mt-1 cursor-pointer rounded border px-1.5 py-0.5 text-xs transition-colors ${
                level === extraLevel
                  ? "border-amber-400 bg-amber-400/20 hover:bg-amber-400/35"
                  : "border-gray-600 hover:border-gray-400"
              }`}
            >
              {/* relative + top-px shifts only the painted glyph down a
                  hair -- digits have no descender, so the line box's
                  normal vertical centering (which accounts for descender
                  room letters like "g"/"y" would need) leaves a bare
                  digit looking high. A plain positional offset here
                  doesn't touch the button's own border-box size/position,
                  unlike padding would. */}
              <span className="relative top-px">{extraLevel}</span>
            </button>
          ))}
        </div>
      </div>

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
          // min-h-9 reserves the same height ConstellationIcons' own row of
          // h-9 badges always takes -- without it, the editor visibly grows
          // the moment data resolves and this one-line placeholder gets
          // replaced by the real (much taller) content, the same class of
          // jump the level-100 button and the stats box had earlier.
          <p className="flex min-h-9 items-center text-sm text-gray-500">Loading...</p>
        ) : (
          <ConstellationIcons
            element={selectedElement}
            constellations={data.constellations}
            constellation={constellation}
            onChange={handleConstellationChange}
          />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Talents</p>
        {!data ? (
          // 172px = 3 combat-talent rows (36px each) + the passives row
          // (40px, its own pt-1 included) + 3 gaps of space-y-2 (8px) --
          // the common case (a character with at least one passive); same
          // reasoning as Constellation's min-h-9 above.
          <p className="flex min-h-[172px] items-center text-sm text-gray-500">Loading...</p>
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

      {/* -mr-9 cancels 36px of the form column's own pr-14 (56px) for this
          row specifically, leaving exactly 20px -- matching the 20px gap
          between the splash column and the divider's own left end (this
          row's unmodified left edge, one p-5 past the splash column), so
          the divider sits symmetrically between them rather than hugging
          the close button on one side only. The button (justify-end,
          flush to this row's own edge) lands at that same right boundary
          as the divider, same as before. */}
      <div className="-mr-9 flex justify-end border-t pt-3">
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

      {/* fitContent -- the stats box (now w-fit, sized per character's own
          worst-case content) means how wide this editor actually needs to
          be varies by character, so a fixed max-w alone always left a gap
          for anyone narrower than the widest case. fitContent makes
          max-w-[51rem] a ceiling rather than Modal's usual floor, so the
          panel shrinks to each character's own content -- nothing left to
          tune per-character here anymore. */}
      <Modal
        open={editingCharacter !== null}
        onClose={() => setEditingId(null)}
        maxWidthClassName="max-w-[51rem]"
        fitContent
        closeButtonClassName="text-white hover:bg-white/10"
      >
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
