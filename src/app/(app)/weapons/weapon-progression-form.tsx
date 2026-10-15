"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { DiamondSelector } from "@/components/diamond-selector";
import { StatBonusList } from "@/components/stat-bonus-list";
import { HighlightedText } from "@/components/highlighted-text";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  MAX_ASCENSION_PHASE,
  validAscensionPhasesForLevel,
  maxLevelForAscensionPhase,
  minLevelForAscensionPhase,
} from "@/lib/ascension";
import { formatStatValue } from "@/lib/stat-format";
import { roundHalfUp } from "@/lib/round";
import { computeWeaponAttack, computeWeaponSecondaryStat, isExaiphanesBlade, EXAIPHANES_BLADE_STATES } from "@/lib/weapon-scaling";
import {
  renderWeaponPassiveDescription,
  computeWeaponValueCurve,
  type WeaponRefinementCurveType,
  type WeaponValueCurveType,
} from "@/lib/weapon-refinement-scaling";
import { getWeaponProgressionData, type WeaponProgressionData } from "./actions";
import { MIN_REFINEMENT, MAX_REFINEMENT, type UpdateWeaponProgressionInput } from "./schemas";

function BaseStatsSection({
  data,
  level,
  ascensionPhase,
  secondaryStatName,
}: {
  data: WeaponProgressionData;
  level: number;
  ascensionPhase: number;
  secondaryStatName: string | null;
}) {
  if (data.attackTier === null) return null;

  const attack = computeWeaponAttack(data.attackTier, data.rarity, level, ascensionPhase, data.attackCurveRarity ?? undefined);
  const secondaryStatValue =
    secondaryStatName && data.baseSecondaryStatValue !== null
      ? computeWeaponSecondaryStat(data.baseSecondaryStatValue, level)
      : null;

  return (
    <div className="space-y-1 rounded border p-2 text-sm">
      <p className="font-medium">Stats</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-500 dark:text-gray-300">
        <li>Base ATK: {roundHalfUp(attack, 0)}</li>
        {secondaryStatName && secondaryStatValue !== null && (
          <li>
            {secondaryStatName}: {formatStatValue(secondaryStatName, secondaryStatValue)}
          </li>
        )}
      </ul>
    </div>
  );
}

// The weapon's passive (if it has one -- low-rarity weapons don't), shown
// with the current refinement's text and stat bonus. The common case
// renders passiveDescriptionTemplate's {0}/{1}/... placeholders via
// @/lib/weapon-refinement-scaling; the one weapon whose refinement text is
// structurally different between tiers (not just reworded numbers) has no
// template at all and falls back to its raw per-refinement row instead --
// see WeaponProgressionData's own comment.
function PassiveSection({ data, refinement }: { data: WeaponProgressionData; refinement: number }) {
  if (!data.passiveName) return null;
  const description = data.passiveDescriptionTemplate
    ? renderWeaponPassiveDescription(
        data.passiveDescriptionTemplate,
        data.refinementValues.map((v) => ({ ...v, curveType: v.curveType as WeaponRefinementCurveType })),
        refinement
      )
    : data.refinementEffects.find((e) => e.refinement === refinement)?.description;
  if (!description) return null;
  const statBonuses = data.statBonuses.map((b) => ({
    statTypeName: b.statTypeName,
    value: computeWeaponValueCurve({ ...b, curveType: b.curveType as WeaponValueCurveType }, refinement),
  }));

  return (
    <div className="space-y-1 rounded border p-2 text-sm">
      <p className="font-medium text-yellow-100">{data.passiveName}</p>
      <p className="whitespace-pre-line text-gray-500 dark:text-gray-300">
        <HighlightedText text={description} talentNames={[data.passiveName]} />
      </p>
      <StatBonusList statBonuses={statBonuses} />
    </div>
  );
}

// Shared level/ascension/refinement form, used both by the owned-weapons
// page (editing an existing copy, submitLabel="Save") and the add-weapon
// catalog's "customize before adding" modal (submitLabel="Add", starting
// from defaultWeaponProgression() instead of a saved copy's own values) --
// same UI either way, just a different starting point and what happens on
// submit. Ascension is constrained by level in both directions: the level
// slider snaps ascension to the closest still-valid phase, and clicking an
// ascension diamond pulls the level into whatever's valid at that phase.
// Progression data (base stats/passive) is fetched lazily here rather than
// passed in -- only the weapon actually being viewed/added needs it, and
// it's a much heavier query than either call site's own list/catalog one.
export function WeaponProgressionForm({
  weaponId,
  name,
  rarity,
  iconUrl,
  secondaryStatName,
  initialLevel,
  initialAscensionPhase,
  initialRefinement,
  submitLabel,
  onSubmit,
}: {
  weaponId: number;
  name: string;
  rarity: number;
  iconUrl: string | null;
  secondaryStatName: string | null;
  initialLevel: number;
  initialAscensionPhase: number;
  initialRefinement: number;
  submitLabel: string;
  onSubmit: (input: UpdateWeaponProgressionInput) => void;
}) {
  const [level, setLevel] = useState(initialLevel);
  const [ascensionPhase, setAscensionPhase] = useState(initialAscensionPhase);
  const [refinement, setRefinement] = useState(initialRefinement);
  const [data, setData] = useState<WeaponProgressionData | null>(null);

  // Exaiphanes Blade: level/ascensionPhase/refinement are driven together
  // by this one selector instead of independently -- see
  // EXAIPHANES_BLADE_STATES. Falls back to state 0 if the starting values
  // don't exactly match any state (shouldn't happen in practice -- both
  // call sites' starting values are always one of the 7 states already).
  const [statuesUnlocked, setStatuesUnlocked] = useState(() => {
    const index = EXAIPHANES_BLADE_STATES.findIndex(
      (s) => s.level === initialLevel && s.ascensionPhase === initialAscensionPhase && s.refinement === initialRefinement
    );
    return index === -1 ? 0 : index;
  });

  function handleStatuesUnlockedChange(newStatuesUnlocked: number) {
    setStatuesUnlocked(newStatuesUnlocked);
    const state = EXAIPHANES_BLADE_STATES[newStatuesUnlocked];
    setLevel(state.level);
    setAscensionPhase(state.ascensionPhase);
    setRefinement(state.refinement);
  }

  useEffect(() => {
    let cancelled = false;
    getWeaponProgressionData(weaponId).then((result) => {
      if (cancelled) return;
      setData(result);
      // A documented few weapons cap below the universal MAX_REFINEMENT
      // (see Weapon.maxRefinement) -- pull an already-set refinement down
      // to whatever this specific weapon actually supports.
      setRefinement((prev) => Math.min(prev, result.maxRefinement));
    });
    return () => {
      cancelled = true;
    };
  }, [weaponId]);

  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    const phases = validAscensionPhasesForLevel(newLevel);
    if (!phases.includes(ascensionPhase)) {
      setAscensionPhase(phases[phases.length - 1]);
    }
  }

  function handleAscensionPhaseChange(newPhase: number) {
    setAscensionPhase(newPhase);
    const min = minLevelForAscensionPhase(newPhase);
    const max = maxLevelForAscensionPhase(newPhase);
    setLevel((prev) => Math.min(max, Math.max(min, prev)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg p-1.5 ${rarityGradientClasses(rarity)}`}>
          {iconUrl && <Image src={iconUrl} alt="" width={56} height={56} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{name}</p>
        </div>
      </div>

      {isExaiphanesBlade(name) ? (
        <div className="space-y-1">
          <p className="text-sm">Statues Unlocked</p>
          <DiamondSelector
            count={EXAIPHANES_BLADE_STATES.length - 1}
            value={statuesUnlocked}
            onChange={handleStatuesUnlockedChange}
            litClassName="border-amber-400 bg-amber-400"
            ariaLabel={(n) => `${n} statues unlocked`}
          />
          <p className="text-xs text-gray-400">
            Level {level}, Ascension {ascensionPhase}, Refinement R{refinement}
          </p>
        </div>
      ) : (
        <>
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
            <span className="w-14 text-gray-400">
              {level}/{maxLevelForAscensionPhase(ascensionPhase)}
            </span>
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

          <label className="flex items-center gap-2 text-sm">
            Refinement
            <input
              type="range"
              min={MIN_REFINEMENT}
              max={data?.maxRefinement ?? MAX_REFINEMENT}
              value={refinement}
              onChange={(event) => setRefinement(Number(event.target.value))}
              className="w-32"
            />
            <span className="w-8 text-gray-400">R{refinement}</span>
          </label>
        </>
      )}

      {!data ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <BaseStatsSection data={data} level={level} ascensionPhase={ascensionPhase} secondaryStatName={secondaryStatName} />
          <PassiveSection data={data} refinement={refinement} />
        </>
      )}

      <div className="flex justify-end border-t pt-3">
        <button
          type="button"
          onClick={() => onSubmit({ level, ascensionPhase, refinement })}
          className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
