"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { useDialogs } from "@/components/dialog-provider";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import { Modal } from "@/components/modal";
import { DiamondSelector } from "@/components/diamond-selector";
import { StatBonusList } from "@/components/stat-bonus-list";
import { HighlightedText } from "@/components/highlighted-text";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  MAX_ASCENSION_PHASE,
  validAscensionPhasesForLevel,
  maxLevelForAscensionPhase,
  minLevelForAscensionPhase,
} from "@/lib/ascension";
import { formatStatValue } from "@/lib/stat-format";
import { computeWeaponAttack, computeWeaponSecondaryStat } from "@/lib/weapon-scaling";
import {
  renderWeaponPassiveDescription,
  computeWeaponValueCurve,
  type WeaponRefinementCurveType,
  type WeaponValueCurveType,
} from "@/lib/weapon-refinement-scaling";
import type { SortDirection } from "@/lib/sort";
import { WeaponTypeFilterRow } from "@/components/weapon-type-filter-row";
import { WeaponCard } from "./weapon-card";
import { removeWeapon, updateWeaponProgression, getWeaponProgressionData, type WeaponProgressionData } from "./actions";
import { MIN_REFINEMENT, MAX_REFINEMENT, type UpdateWeaponProgressionInput } from "./schemas";
import { filterAndSortOwnedWeapons, type OwnedWeaponItem, type OwnedSortKey } from "./filter-sort";

// Weapons are seeded from 3-5 star (see prisma/seed.ts).
const RARITIES = [5, 4, 3];

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

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
        <li>Base ATK: {Math.round(attack)}</li>
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

// Modal body for editing level/ascension/refinement, plus (once data loads)
// the weapon's base ATK/secondary stat at the current level+ascension and
// its passive text/stat bonus at the current refinement. Ascension is
// constrained by level in both directions, same as Characters: the level
// slider snaps ascension to the closest still-valid phase, and clicking an
// ascension diamond pulls the level into whatever's valid at that phase.
// Fetched lazily here rather than bundled into the main owned-weapons
// query -- only the weapon currently being edited needs this.
function WeaponProgressionEditor({
  weapon,
  onSave,
}: {
  weapon: OwnedWeaponItem;
  onSave: (input: UpdateWeaponProgressionInput) => void;
}) {
  const [level, setLevel] = useState(weapon.level);
  const [ascensionPhase, setAscensionPhase] = useState(weapon.ascensionPhase);
  const [refinement, setRefinement] = useState(weapon.refinement);
  const [data, setData] = useState<WeaponProgressionData | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeaponProgressionData(weapon.weaponId).then((result) => {
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
  }, [weapon.weaponId]);

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
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg p-1.5 ${rarityGradientClasses(weapon.rarity)}`}
        >
          {weapon.iconUrl && <Image src={weapon.iconUrl} alt="" width={56} height={56} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{weapon.name}</p>
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

      {!data ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <BaseStatsSection data={data} level={level} ascensionPhase={ascensionPhase} secondaryStatName={weapon.secondaryStatName} />
          <PassiveSection data={data} refinement={refinement} />
        </>
      )}

      <div className="flex justify-end border-t pt-3">
        <button
          type="button"
          onClick={() => onSave({ level, ascensionPhase, refinement })}
          className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function OwnedWeaponManager({ initialOwnedWeapons }: { initialOwnedWeapons: OwnedWeaponItem[] }) {
  useRefreshOnBackNavigation();
  const [owned, setOwned] = useState(initialOwnedWeapons);
  // useState(initialOwnedWeapons) only ever consults that argument on the
  // very first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialOwnedWeapons, setPrevInitialOwnedWeapons] = useState(initialOwnedWeapons);
  if (initialOwnedWeapons !== prevInitialOwnedWeapons) {
    setPrevInitialOwnedWeapons(initialOwnedWeapons);
    setOwned(initialOwnedWeapons);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const [search, setSearch] = useState("");
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<OwnedSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = filterAndSortOwnedWeapons(owned, {
    search,
    weaponTypeFilter,
    rarityFilter,
    sortKey,
    sortDirection,
  });
  const editingWeapon = editingId === null ? null : (owned.find((w) => w.id === editingId) ?? null);

  function handleUpdateProgression(ownedWeaponId: number, input: UpdateWeaponProgressionInput) {
    const previous = owned;
    setOwned((prev) => prev.map((weapon) => (weapon.id === ownedWeaponId ? { ...weapon, ...input } : weapon)));
    setEditingId(null);

    startTransition(async () => {
      const result = await updateWeaponProgression(ownedWeaponId, input).catch(() => ({ errors: {} }) as const);
      if ("errors" in result) setOwned(previous);
    });
  }

  async function handleRemove(ownedWeaponId: number) {
    const confirmed = await confirm("Remove this weapon? This can't be undone.", {
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;

    startTransition(() => {
      const previous = owned;
      setOwned((prev) => prev.filter((weapon) => weapon.id !== ownedWeaponId));
      removeWeapon(ownedWeaponId).catch(() => setOwned(previous));
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
          <option value="refinement">Sort: Refinement</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
      </div>

      <WeaponTypeFilterRow
        weaponTypeFilter={weaponTypeFilter}
        onToggle={(weaponType) => setWeaponTypeFilter((prev) => toggleInSet(prev, weaponType))}
      />
      <RarityFilterRow
        rarities={RARITIES}
        rarityFilter={rarityFilter}
        onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
      />

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {filtered.length} weapon{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filtered.map((weapon) => (
          <WeaponCard
            key={weapon.id}
            name={weapon.name}
            weaponType={weapon.weaponType}
            rarity={weapon.rarity}
            secondaryStatName={weapon.secondaryStatName}
            iconUrl={weapon.iconUrl}
            refinement={weapon.refinement}
            actionLabel="Remove"
            onAction={() => handleRemove(weapon.id)}
            danger
            level={weapon.level}
            onEdit={() => setEditingId(weapon.id)}
            isActive={weapon.id === editingId}
          />
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500">No weapons match these filters.</p>}
      </ul>

      <Modal open={editingWeapon !== null} onClose={() => setEditingId(null)} maxWidthClassName="max-w-xl">
        {editingWeapon && (
          <WeaponProgressionEditor
            key={editingWeapon.id}
            weapon={editingWeapon}
            onSave={(input) => handleUpdateProgression(editingWeapon.id, input)}
          />
        )}
      </Modal>
    </div>
  );
}
