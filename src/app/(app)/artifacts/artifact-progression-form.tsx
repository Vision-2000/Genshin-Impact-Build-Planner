"use client";

import { useState } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { formatStatValue } from "@/lib/stat-format";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { SplashImage } from "@/components/splash-image";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import {
  MAX_SUBSTATS,
  MIN_LEVEL,
  SLOT_MAIN_STATS,
  SUBSTAT_TYPE_NAMES,
  computeArtifactMainStatValue,
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
  const mainStatName = statTypeById.get(mainStatId)?.name;
  const mainStatValueDisplay = mainStatName
    ? formatStatValue(mainStatName, computeArtifactMainStatValue(mainStatName, rarity, level))
    : null;

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
      {/* The whole column is the hover target -- MouseFollowTooltip's own
          wrapperClassName carries this column's layout/sizing (so it
          still participates correctly in the outer flex row), and the
          name/image below become its children instead of a plain div's.
          content is the exact same 2pc/4pc markup ArtifactCard's own
          tooltip uses (see artifact-catalog.tsx/owned-artifact-manager.tsx),
          shown on hover instead of inline now that the set's own name
          already appears in the header above -- no separate black box
          needed, since MouseFollowTooltip's own tooltip chrome already
          renders on a dark background. */}
      <MouseFollowTooltip
        wrapperClassName={`relative flex h-64 w-full shrink-0 flex-col sm:h-auto sm:w-72 ${rarityGradientClasses(rarity)}`}
        content={
          <>
            <p className="text-base font-semibold text-yellow-100">{set.name}</p>
            <p className="mt-2 text-gray-300">
              <span className="font-semibold text-yellow-100">2pc: </span>
              {set.twoPieceEffect}
            </p>
            {set.fourPieceEffect && (
              <p className="mt-2 text-gray-300">
                <span className="font-semibold text-yellow-100">4pc: </span>
                {set.fourPieceEffect}
              </p>
            )}
          </>
        }
      >
        <p className="px-3 pt-2 pl-5 text-2xl font-medium">{set.name}</p>
        {/* A fixed h-36/w-36 box, centered both ways: flex justify-center
            centers it horizontally, and this outer flex-1 justify-center
            splits any leftover column height (whenever the form column
            next to it is taller) evenly above/below it instead of
            leaving it all beneath -- same technique
            WeaponProgressionForm's own splash column uses. */}
        <div className="relative min-h-0 flex-1 sm:flex sm:flex-col sm:justify-center">
          <div className="flex justify-center py-2">
            <div className="relative h-36 w-36 shrink-0">
              {pieceImageUrl && <SplashImage key={pieceImageUrl} src={pieceImageUrl} objectFit="contain" />}
            </div>
          </div>
        </div>
      </MouseFollowTooltip>

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
            Main stat:
            {mainStatNames.length === 1 ? (
              // Flower/Feather only ever have one possible main stat
              // (HP/ATK) -- nothing to actually pick, so skip the
              // dropdown (and its overlay trick below) entirely rather
              // than rendering a disabled <select> with nothing to do.
              // w-[13rem] (not the 12.75rem every other row's own
              // container uses) matches the OTHER rows' real rendered
              // width, not their container's -- that select is itself
              // 0.25rem wider than its container (see its own comment
              // below), so this box has to match that sum, not the
              // 12.75rem value, to look the same size. inline-flex
              // items-center (a plain <span> is inline by default, which
              // doesn't give its own py-1 padding a real box to size
              // against the way a <select>'s own native height does) plus
              // an explicit h-8 -- a native <select>'s real rendered
              // height comes partly from the browser's own UA stylesheet,
              // not just the padding/line-height CSS reproduces, so
              // padding alone (even with inline-flex) still landed
              // visibly taller than the select rows next to it. h-8 pins
              // both this and the select below to the exact same fixed
              // height instead of trying to match it indirectly. text-black
              // (not text-gray-500) -- matches the other rows' own overlay
              // text exactly; bg-gray-100 alone already reads as "disabled"
              // without also needing a dimmer font color. pl-2.5 pr-2 (not
              // px-2) -- matches the other rows' own overlay span padding
              // exactly (see its own comment below); px-2 alone sat
              // slightly further left than those.
              <span className="inline-flex h-8 w-[13rem] items-center rounded border border-gray-300 bg-gray-100 py-1 pl-2.5 pr-2 text-sm text-black">
                {mainStatName} {mainStatValueDisplay}
              </span>
            ) : (
              <div className="relative w-[12.75rem]">
                <select
                  value={mainStatId}
                  onChange={(event) => handleMainStatChange(Number(event.target.value))}
                  // border-gray-300 pinned for both the default AND focus
                  // states (plus focus:outline-none) -- the overlay below
                  // only covers the select's interior, not its border, so
                  // without this the browser's own focus-state border/
                  // outline color (visibly darker) stays uncovered and
                  // doesn't match the overlay's own static appearance.
                  // w-[calc(100%+0.25rem)] -- kept in normal flow (not
                  // absolute, which would take it out of flow and
                  // collapse this container's height) so this just grows
                  // the real select 0.25rem wider than the container,
                  // extending past its right edge; the overlay
                  // (unchanged, sized to the container itself) doesn't
                  // grow with it. h-8 -- see the Flower/Feather span's own
                  // comment above; pins this to the same fixed height
                  // rather than relying on padding to match it.
                  className="h-8 w-[calc(100%+0.25rem)] rounded border border-gray-300 bg-white px-2 py-1 text-sm text-black focus:border-gray-300 focus:outline-none"
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
                {/* pointer-events-none -- lets clicks fall through to the
                    real select underneath; right-3 leaves just enough
                    room for its native dropdown arrow to stay fully
                    visible (tightened from right-7, which cut off more
                    text than the arrow actually needed -- "Energy
                    Recharge%" plus its value was the longest combination
                    and got truncated). inset-y-px/left-px (not
                    inset-y-0/left-0) keeps this just inside the select's
                    own border instead of painting over it, so the border
                    frame stays visible on all sides. The opened list is
                    rendered by the browser outside normal page content,
                    so it's never covered by this overlay -- only the
                    closed box is, which is exactly the one place a plain
                    <select> can't show different text than its own
                    option list. */}
                {mainStatName && (
                  // pl-2.5 (not px-2's own left value) -- a native
                  // <select>'s own option text sits slightly further
                  // right than the same CSS padding reproduces on a
                  // plain span, since the browser adds its own extra
                  // internal inset on top of it; this nudges the overlay
                  // text right to match.
                  <span className="pointer-events-none absolute inset-y-px left-px right-3 flex items-center truncate rounded-l bg-white pl-2.5 pr-2 text-sm text-black">
                    {mainStatName} {mainStatValueDisplay}
                  </span>
                )}
              </div>
            )}
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
