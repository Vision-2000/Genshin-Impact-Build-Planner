"use client";

import { useState } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { formatStatValue } from "@/lib/stat-format";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { SplashImage } from "@/components/splash-image";
import {
  MAX_SUBSTATS,
  MIN_LEVEL,
  SLOT_MAIN_STATS,
  SUBSTAT_TYPE_NAMES,
  maxLevelForRarity,
  substatValidValues,
  nearestValidValue,
  type SubstatTypeName,
} from "./artifact-rules";
import type { StatTypeOption } from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);

// statTypeId is null for a row left on its default "None" option -- the row
// still exists (there are always exactly MAX_SUBSTATS rows) but contributes
// nothing on save.
type DraftSubstat = { statTypeId: number | null; value: number };

function emptySubstatRow(): DraftSubstat {
  return { statTypeId: null, value: 0 };
}

export type ArtifactProgressionInput = {
  slot: ArtifactSlot;
  level: number;
  mainStatId: number;
  substats: { statTypeId: number; value: number }[];
};

// Shared slot/level/main-stat/substat form, used both by the owned-
// artifacts page (editing an existing piece, slotFixed, submitLabel="Save")
// and the add-catalog's "add a piece" modal (slot still pickable,
// submitLabel="Save artifact") -- same two-column, rarity-tinted layout
// WeaponProgressionForm uses (see weapons/weapon-progression-form.tsx),
// with the set's own per-slot art standing in for a weapon's splash art
// (SplashImage, same shared loading-spinner treatment) and
// rarityGradientClasses standing in for element tint (artifacts have no
// element either).
export function ArtifactProgressionForm({
  set,
  getSlotImageUrl,
  statTypes,
  initialSlot,
  slotFixed,
  initialLevel,
  initialMainStatId,
  initialSubstats,
  submitLabel,
  onSubmit,
  onDelete,
  formBackgroundClassName,
}: {
  set: { name: string; rarity: number; twoPieceEffect: string; fourPieceEffect: string | null };
  // Resolves the left column's own piece-image for a given slot -- a
  // function rather than the set's full per-slot icon set, since the
  // owned-artifacts page's own edit modal (slotFixed) only ever has one
  // real icon (that piece's own OwnedArtifactItem.iconUrl, already
  // resolved server-side) and would otherwise need to fabricate the other
  // 4 slots' icon fields just to satisfy a shape it never uses. The
  // add-catalog passes the set's own slotIconUrl (see filter-sort.ts)
  // instead, so this updates live as the slot picker's own selection
  // changes.
  getSlotImageUrl: (slot: ArtifactSlot) => string | null;
  statTypes: StatTypeOption[];
  initialSlot: ArtifactSlot;
  // true for the owned-artifacts page's own edit modal -- a piece's slot
  // is fixed once added (a different slot is a different physical piece),
  // so no picker is rendered and initialSlot passes straight through to
  // onSubmit untouched. false for the add-catalog's own modal, where slot
  // is still an open choice.
  slotFixed: boolean;
  initialLevel: number;
  initialMainStatId: number;
  initialSubstats: { statTypeId: number; value: number }[];
  submitLabel: string;
  onSubmit: (input: ArtifactProgressionInput) => void;
  // Only the owned-artifacts page's own edit modal provides this -- same
  // placement/styling as WeaponProgressionForm's own Delete button
  // (solid red, no border, directly left of Save/Add).
  onDelete?: () => void;
  // Unlike CharacterProgressionEditor (one page, always bg-primary-page),
  // this form is shared by two pages with two different page backgrounds
  // (/artifacts is bg-primary-page, /artifacts/add is bg-secondary-page) --
  // the caller passes whichever one it's actually opened on.
  formBackgroundClassName: string;
}) {
  const statTypeByName = new Map(statTypes.map((s) => [s.name, s]));
  const statTypeById = new Map(statTypes.map((s) => [s.id, s]));
  const rarity = set.rarity;
  const maxLevel = maxLevelForRarity(rarity);

  const [slot, setSlot] = useState(initialSlot);
  const [level, setLevel] = useState(initialLevel);
  const [mainStatId, setMainStatId] = useState(initialMainStatId);
  const [substats, setSubstats] = useState<DraftSubstat[]>(() => {
    const rows: DraftSubstat[] = initialSubstats.map((s) => ({ statTypeId: s.statTypeId, value: s.value }));
    while (rows.length < MAX_SUBSTATS) rows.push(emptySubstatRow());
    return rows;
  });

  const mainStatNames = SLOT_MAIN_STATS[slot];

  function handleSlotChange(newSlot: ArtifactSlot) {
    setSlot(newSlot);
    const validNames = SLOT_MAIN_STATS[newSlot];
    const currentName = statTypeById.get(mainStatId)?.name;
    const nextMainStatId =
      currentName && validNames.includes(currentName) ? mainStatId : statTypeByName.get(validNames[0])?.id ?? mainStatId;

    setMainStatId(nextMainStatId);
    // A row that was using the old main stat's slot can't keep it -- reset
    // that row to "None" rather than removing it, since there are always
    // exactly MAX_SUBSTATS rows.
    setSubstats((prev) => prev.map((s) => (s.statTypeId === nextMainStatId ? emptySubstatRow() : s)));
  }

  // A stat can't be both the main stat and a substat -- clear any row that
  // collides with the newly picked main stat.
  function handleMainStatChange(nextMainStatId: number) {
    setMainStatId(nextMainStatId);
    setSubstats((prev) => prev.map((s) => (s.statTypeId === nextMainStatId ? emptySubstatRow() : s)));
  }

  function substatOptionsExcluding(excludeIndex: number): StatTypeOption[] {
    const used = new Set(
      substats
        .filter((_, i) => i !== excludeIndex)
        .map((s) => s.statTypeId)
        .filter((id): id is number => id !== null)
    );
    used.add(mainStatId);
    return SUBSTAT_TYPE_NAMES.map((name) => statTypeByName.get(name)).filter(
      (s): s is StatTypeOption => !!s && !used.has(s.id)
    );
  }

  function updateSubstatRow(index: number, changes: Partial<DraftSubstat>) {
    setSubstats((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  }

  // Selecting "None" clears the row; picking a stat defaults to its lowest
  // achievable value (the slider's leftmost position).
  function handleSubstatTypeChange(index: number, statTypeId: number | null) {
    if (statTypeId === null) {
      updateSubstatRow(index, emptySubstatRow());
      return;
    }
    const name = statTypeById.get(statTypeId)?.name as SubstatTypeName | undefined;
    const values = name ? substatValidValues(name, rarity, level) : [0];
    updateSubstatRow(index, { statTypeId, value: values[0] });
  }

  // Changing level shifts which values each substat can hold, so snap every
  // set substat to the closest value still valid at the new level.
  function handleLevelChange(newLevel: number) {
    setLevel(newLevel);
    setSubstats((prev) =>
      prev.map((s) => {
        if (s.statTypeId === null) return s;
        const name = statTypeById.get(s.statTypeId)?.name as SubstatTypeName | undefined;
        if (!name) return s;
        const values = substatValidValues(name, rarity, newLevel);
        return { ...s, value: nearestValidValue(values, s.value) };
      })
    );
  }

  function handleSubmit() {
    const payload = substats
      .filter((s): s is { statTypeId: number; value: number } => s.statTypeId !== null)
      .map((s) => ({ statTypeId: s.statTypeId, value: s.value }));
    onSubmit({ slot, level, mainStatId, substats: payload });
  }

  const pieceImageUrl = getSlotImageUrl(slot);

  return (
    // -m-5 bleeds back out over the Modal's own padding, same as
    // WeaponProgressionForm/CharacterProgressionEditor.
    <div className="relative -m-5 flex flex-col overflow-hidden rounded-lg text-white sm:flex-row">
      {/* sm:w-96 (not weapon's own sm:w-72) -- unlike weapons, whose long
          passive text lives in the FORM column, a set's 2pc/4pc effect
          text lives in this column, and a 4pc effect can run past 800
          characters (e.g. Song of Days Past) -- the extra width cuts down
          how many lines that wraps into, so the box needs less internal
          scrolling. */}
      <div className={`relative flex h-64 w-full shrink-0 flex-col sm:h-auto sm:w-96 ${rarityGradientClasses(rarity)}`}>
        <p className="px-3 pt-2 pl-5 text-2xl font-medium">{set.name}</p>
        {/* A fixed h-36/w-36 box, centered, rather than filling the
            column's own (now wider, for the text box below) width -- a
            set's per-slot art is a small item icon, and stretching it to
            the full column width made it look oversized. flex-none (no
            centering/leftover-space logic like WeaponProgressionForm's
            own splash column) -- the 2pc/4pc text below absorbs any
            leftover height instead, so there's no empty space left to
            distribute around the image in the first place. */}
        <div className="flex justify-center py-2">
          <div className="relative h-36 w-36 shrink-0">
            {pieceImageUrl && <SplashImage key={pieceImageUrl} src={pieceImageUrl} objectFit="contain" />}
          </div>
        </div>
        {/* mx-3 mb-2 (margin, not padding) -- the black box below needs
            its own internal p-3, same as WeaponProgressionForm's own
            passive box; flex-1 + overflow-y-auto fills whatever height is
            left in this column (typically set by the form column next to
            it being taller) instead of just the text's own natural
            height, and scrolls internally if a long 4pc effect still
            exceeds it. */}
        <div className="mx-3 mb-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded border bg-black p-3 text-sm">
          <p className="text-gray-300">
            <span className="font-semibold text-yellow-100">2pc: </span>
            {set.twoPieceEffect}
          </p>
          {set.fourPieceEffect && (
            <p className="text-gray-300">
              <span className="font-semibold text-yellow-100">4pc: </span>
              {set.fourPieceEffect}
            </p>
          )}
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col justify-start p-5 pr-14 ${formBackgroundClassName}`}>
        <div className="flex h-full w-fit flex-col gap-4">
          {!slotFixed && (
            <div className="space-y-1">
              <p className="text-sm">Slot</p>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((candidateSlot) => {
                  const isSelected = slot === candidateSlot;
                  return (
                    <button
                      key={candidateSlot}
                      type="button"
                      onClick={() => handleSlotChange(candidateSlot)}
                      aria-pressed={isSelected}
                      className={`flex w-20 flex-col items-center gap-1 rounded-lg border-4 p-2 ${
                        isSelected ? "border-amber-400 bg-black/40" : "border-transparent bg-black/20"
                      }`}
                    >
                      <Image src={ARTIFACT_SLOT_ICON_URL[candidateSlot]} alt="" width={40} height={40} />
                      <span className="text-xs font-medium text-white">{candidateSlot}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            Level
            <input
              type="range"
              min={MIN_LEVEL}
              max={maxLevel}
              value={level}
              onChange={(event) => handleLevelChange(Number(event.target.value))}
              className="-mt-1 w-32"
            />
            <span className="w-8">+{level}</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            Main stat
            <select
              value={mainStatId}
              onChange={(event) => handleMainStatChange(Number(event.target.value))}
              disabled={mainStatNames.length === 1}
              className="w-[11.5rem] rounded border bg-white px-2 py-1 text-sm text-black disabled:bg-gray-100 disabled:text-gray-500"
            >
              {mainStatNames.map((name) => {
                const option = statTypeByName.get(name);
                return option ? (
                  <option key={option.id} value={option.id}>
                    {name}
                  </option>
                ) : null;
              })}
            </select>
          </label>

          <div className="space-y-1">
            <p className="text-sm">Substats</p>
            {substats.map((substat, index) => {
              const statName = statTypeById.get(substat.statTypeId ?? -1)?.name as SubstatTypeName | undefined;
              const values = statName ? substatValidValues(statName, rarity, level) : [0];
              // The slider steps through indices into `values` rather than
              // the values themselves, since they aren't evenly spaced
              // (only specific roll-combination sums are ever achievable).
              const currentIndex = values.indexOf(nearestValidValue(values, substat.value));

              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    value={substat.statTypeId ?? ""}
                    onChange={(event) =>
                      handleSubstatTypeChange(index, event.target.value === "" ? null : Number(event.target.value))
                    }
                    className="w-44 shrink-0 rounded border bg-white px-2 py-1 text-sm text-black"
                  >
                    <option value="">None</option>
                    {substatOptionsExcluding(index).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                    {!substatOptionsExcluding(index).some((o) => o.id === substat.statTypeId) &&
                      statTypeById.get(substat.statTypeId ?? -1) && (
                        <option value={substat.statTypeId ?? ""}>
                          {statTypeById.get(substat.statTypeId ?? -1)?.name}
                        </option>
                      )}
                  </select>
                  {substat.statTypeId !== null && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={values.length - 1}
                        step={1}
                        value={currentIndex}
                        onChange={(event) => updateSubstatRow(index, { value: values[Number(event.target.value)] })}
                        className="w-28"
                      />
                      <span className="w-14 text-sm">{formatStatValue(statName ?? "", values[currentIndex])}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="-mr-9 mt-auto flex items-center justify-end gap-2 border-t pt-3">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete artifact
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
