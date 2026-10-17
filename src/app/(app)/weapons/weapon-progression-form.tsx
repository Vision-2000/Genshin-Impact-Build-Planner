"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { SplashImage } from "@/components/splash-image";
import { DiamondSelector } from "@/components/diamond-selector";
import { StatLine } from "@/components/stat-line";
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
import { tokenizeWeaponPassiveDescription, type WeaponRefinementCurveType } from "@/lib/weapon-refinement-scaling";
import { getWeaponProgressionData, type WeaponProgressionData } from "./actions";
import { MIN_REFINEMENT, MAX_REFINEMENT, type UpdateWeaponProgressionInput } from "./schemas";

// One fixed width for both boxes below, regardless of passive length --
// tried a two-tier "widen past some estimated line count" mechanism first
// (see git history), but a flat character-count estimate can't reliably
// predict real proportional-font line wrapping, and it's not needed
// anyway: the form column is simply allowed to grow taller than the
// splash column when a passive needs more room (see this column's own
// comment below), so there's nothing to widen for in the first place.
const PASSIVE_WIDTH_CLASS = "w-[28rem]";

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

  // Worst-case equivalents (max level, max ascension phase) for StatLine's
  // own ghost text -- computeWeaponAttack/computeWeaponSecondaryStat are
  // both monotonically increasing in level/ascensionPhase (same curve
  // shape as character-scaling.ts's own stats, just one fewer input), so
  // this combination is always this weapon's single largest possible
  // reading for both values below, regardless of what level/phase they're
  // actually sitting at. See StatLine's own comment for why this matters.
  const maxAttack = computeWeaponAttack(data.attackTier, data.rarity, MAX_LEVEL, MAX_ASCENSION_PHASE, data.attackCurveRarity ?? undefined);
  const maxSecondaryStatValue =
    secondaryStatName && data.baseSecondaryStatValue !== null
      ? computeWeaponSecondaryStat(data.baseSecondaryStatValue, MAX_LEVEL)
      : null;

  return (
    // -mr-9 -- same alignment trick as CharacterProgressionEditor's own
    // stats box (identical p-5/pr-14 geometry on the form column around
    // this), extending this box 36px further right so its edge lines up
    // with the close button instead of stopping at the pr-14 gap.
    <div className={`-mr-9 rounded border bg-black p-3 text-sm ${PASSIVE_WIDTH_CLASS}`}>
      <p className="font-medium">Stats</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <StatLine current={`Base ATK: ${roundHalfUp(attack, 0)}`} ghost={`Base ATK: ${roundHalfUp(maxAttack, 0)}`} />
        {secondaryStatName && secondaryStatValue !== null && maxSecondaryStatValue !== null && (
          <StatLine
            current={`${secondaryStatName}: ${formatStatValue(secondaryStatName, secondaryStatValue)}`}
            ghost={`${secondaryStatName}: ${formatStatValue(secondaryStatName, maxSecondaryStatValue)}`}
          />
        )}
      </ul>
    </div>
  );
}

// Renders one scaling value inline, pinned to its own worst-case width
// (see tokenizeWeaponPassiveDescription's own comment) -- the invisible
// `widest` span (normal flow) sets this span's box size, while `current`
// (absolutely positioned over it) is what's actually seen. Unlike
// StatLine's block-level version, this needs inline-block: it has to sit
// mid-sentence, between ordinary text nodes, as a single unbreakable unit
// the line-wrapping algorithm treats like one word.
function InlinePassiveValue({ current, widest }: { current: string; widest: string }) {
  return (
    <span className="relative inline-block">
      <span className="invisible">{widest}</span>
      {/* text-center -- when `current` is shorter than `widest` (the
          common case), the leftover space inside this pinned-width box
          would otherwise sit entirely on the right (default left-aligned
          text), reading as an odd gap before the next word. Centering
          splits it evenly on both sides instead. */}
      <span className="absolute inset-0 text-center font-medium text-sky-400">{current}</span>
    </span>
  );
}

// The weapon's passive (if it has one -- low-rarity weapons don't), shown
// with the current refinement's text. The common case renders
// passiveDescriptionTemplate's {0}/{1}/... placeholders via
// tokenizeWeaponPassiveDescription, each one pinned to its own worst-case
// width inline (InlinePassiveValue above) -- necessary because a
// paragraph-level ghost (an earlier version of this: re-render the whole
// description once more with every value at its own widest, overlaid
// invisibly just to reserve height) only keeps the BOX from resizing; the
// real paragraph still re-wraps using its own actual content, so a word
// well after a scaling number could still visibly jump to the next line
// whenever that number's own width changed between refinements (confirmed
// on Beyond the Chrysalis's "Winds of Plenty" passive: "equipping" wraps
// to the next line at R2/R4 but not R1/R3/R5, purely because of that
// refinement's own Elemental Mastery value being wider). Pinning each
// value's own width independently keeps every wrap point identical no
// matter which refinement is showing, since the literal text between
// placeholders never changes and now neither does anything in between.
//
// The one weapon whose refinement text is structurally different between
// tiers (not just reworded numbers) has no template at all and falls back
// to its raw per-refinement row instead -- see WeaponProgressionData's own
// comment. It has no placeholders to pin individually (and its own tiers
// differ by a whole added clause, not a reworded number), so it keeps the
// coarser whole-paragraph ghost, sized to the longest literal string
// among its own known refinements. Deliberately no stat-bonus restatement
// below the text -- the passive's own description already says it, same
// reasoning the add-catalog hover tooltip already applies.
function PassiveSection({ data, refinement }: { data: WeaponProgressionData; refinement: number }) {
  if (!data.passiveName) return null;

  if (data.passiveDescriptionTemplate) {
    const slots = data.refinementValues.map((v) => ({ ...v, curveType: v.curveType as WeaponRefinementCurveType }));
    const tokens = tokenizeWeaponPassiveDescription(data.passiveDescriptionTemplate, slots, refinement, data.maxRefinement);

    return (
      // -mr-9 -- same reasoning as BaseStatsSection's own comment above.
      <div className={`-mr-9 rounded border bg-black p-3 text-sm ${PASSIVE_WIDTH_CLASS}`}>
        <p className="font-medium text-yellow-100">{data.passiveName}</p>
        <p className="mt-1 whitespace-pre-line text-gray-300">
          {tokens.map((token, i) =>
            token.kind === "text" ? token.text : <InlinePassiveValue key={i} current={token.current} widest={token.widest} />
          )}
        </p>
      </div>
    );
  }

  const description = data.refinementEffects.find((e) => e.refinement === refinement)?.description;
  if (!description) return null;
  const ghostDescription = data.refinementEffects.reduce(
    (longest, e) => (e.description.length > longest.length ? e.description : longest),
    description
  );

  return (
    // -mr-9 -- same reasoning as BaseStatsSection's own comment above.
    <div className={`-mr-9 rounded border bg-black p-3 text-sm ${PASSIVE_WIDTH_CLASS}`}>
      <p className="font-medium text-yellow-100">{data.passiveName}</p>
      <div className="relative mt-1">
        <p className="invisible whitespace-pre-line">{ghostDescription}</p>
        <p className="absolute inset-0 whitespace-pre-line text-gray-300">{description}</p>
      </div>
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
//
// Laid out as a two-column, rarity-tinted panel -- the same splash-art/
// form-column split CharacterProgressionEditor uses (see
// owned-character-manager.tsx), with the weapon's own gacha-art splashUrl
// (see Weapon.splashUrl) now standing in for a character's own splash art,
// rendered via the same shared SplashImage both editors use, and
// rarityGradientClasses standing in for element-tinted background (weapons
// have no element either).
export function WeaponProgressionForm({
  weaponId,
  name,
  weaponType,
  rarity,
  splashUrl,
  secondaryStatName,
  initialLevel,
  initialAscensionPhase,
  initialRefinement,
  submitLabel,
  onSubmit,
  onDelete,
  formBackgroundClassName,
}: {
  weaponId: number;
  name: string;
  weaponType: WeaponType;
  rarity: number;
  splashUrl: string | null;
  secondaryStatName: string | null;
  initialLevel: number;
  initialAscensionPhase: number;
  initialRefinement: number;
  submitLabel: string;
  onSubmit: (input: UpdateWeaponProgressionInput) => void;
  // Only the owned-weapons page's own edit modal provides this -- the
  // add-catalog's "customize before adding" modal has nothing to delete
  // yet (the weapon isn't owned until Submit is pressed). Sits directly
  // left of the Save/Add button rather than ArtifactCard's own modal's
  // justify-between-opposite-corner placement, styled like it (solid
  // red fill, same shape as the card's own Remove button) rather than
  // that modal's bordered/text-red treatment.
  onDelete?: () => void;
  // Unlike CharacterProgressionEditor (one page, always bg-primary-page),
  // this form is shared by two pages with two different page backgrounds
  // (/weapons is bg-primary-page, /weapons/add is bg-secondary-page) -- the
  // caller passes whichever one it's actually opened on, so the form
  // column matches the page behind the modal instead of picking one
  // fixed background regardless of context.
  formBackgroundClassName: string;
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
    // -m-5 bleeds back out over the Modal's own padding so this fills the
    // whole rounded panel, same as CharacterProgressionEditor. text-white
    // is forced site-wide for the same reason as there: most labels here
    // rely on the default (theme-dependent) foreground color, which isn't
    // reliably legible over a dark rarity-tinted panel. Rarity tint lives
    // on the splash column alone (not this outer wrapper) and the form
    // column gets its own flat background -- same split as
    // CharacterProgressionEditor's element-tint-on-splash-column-only /
    // bg-primary-page-on-form-column treatment.
    <div className="relative -m-5 flex flex-col overflow-hidden rounded-lg text-white sm:flex-row">
      {/* sm:h-auto (not a fixed sm:h-<n>) -- this column's total height is
          now just the sum of its two children: the header (name/icon/
          rarity row) takes whatever height ITS content needs, and the
          image box below is pinned to a fixed size independently (see
          its own aspect-[1/2] comment) -- so a 2-line weapon name grows
          the header without shrinking the art to compensate, unlike
          giving aspect-ratio to this whole column (the earlier approach),
          which forced a fixed TOTAL that the header and image then had to
          divide between them, so a taller header silently stole space
          the image would otherwise have used. sm:w-72 (not Character's
          own sm:w-96) is still just this column's own width -- picked
          smaller than Character's because that width's own 1:2-derived
          image size left a lot of empty space below an average-length
          passive's content. */}
      <div className={`relative flex h-64 w-full shrink-0 flex-col sm:h-auto sm:w-72 ${rarityGradientClasses(rarity)}`}>
        <div className="px-3 pt-3">
          <p className="pl-2 text-2xl font-medium">{name}</p>
          <div className="mt-1 flex items-center gap-2 pl-2">
            <Image src={WEAPON_TYPE_ICON_URL[weaponType]} alt={weaponType} title={weaponType} width={32} height={32} />
            <div className="flex items-center gap-0.5" aria-label={`Rarity ${rarity}`}>
              {Array.from({ length: rarity }, (_, i) => i).map((i) => (
                <span key={i} className="text-xl text-amber-400">
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* object-contain (not cover) since every weapon's gacha art
            shares the same 512x1024 portrait aspect ratio (unlike
            Characters, no per-weapon exception is needed here -- see
            data-source/weapons.json's splashUrl). The inner box pins its
            own height from its real width (stretched to the column's
            fixed sm:w-72 by this outer flex-col's own default cross-axis
            stretch) and the art's own fixed 512x1024 ratio, independent
            of the header above it -- a flex item's own aspect-ratio takes
            precedence over align-items: stretch once, like here, one
            axis is already definite. sm:flex-none on the inner box
            removes any competing flex-grow that would otherwise try to
            consume leftover space on the main axis instead -- that
            leftover space (whenever the form column next to this one
            ends up taller, since this column no longer grows to match
            it) belongs to the OUTER box's own sm:justify-center instead,
            splitting it evenly above and below the art rather than the
            art sitting flush under the header with all of it left
            beneath. Mobile (no sm: layout applies) keeps the plain
            flex-1-fills-available-space behavior this always had, no
            centering -- there's nothing for it to center against there,
            since the mobile column's own total height is just its own
            fixed h-64. */}
        <div className="relative min-h-0 flex-1 sm:flex sm:flex-col sm:justify-center">
          <div className="relative h-full w-full sm:h-auto sm:aspect-[1/2] sm:flex-none">
            {splashUrl && <SplashImage key={splashUrl} src={splashUrl} objectFit="contain" />}
          </div>
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col justify-start p-5 pr-14 ${formBackgroundClassName}`}>
        {/* Used to cap this column's height and wrap overflow into a
            second column instead of growing taller than the splash art --
            abandoned: an unusually long passive (Disaster and Remorse's,
            by far the longest of any weapon) could still exceed that cap
            on its own, pushing just the trailing Save/Add button into an
            awkward, too-narrow second column that overlapped the close
            button. h-full + flex-col + mt-auto on the button row below is
            simpler and has no failure mode like that: this column is
            always exactly as tall as its own content needs (growing past
            the splash art's height when a passive genuinely needs more
            room, same as any normal block layout), and the button row
            gets pushed to the bottom of whatever that ends up being via
            mt-auto -- flush against it when content is short enough to
            leave room, immediately after the content when it isn't. */}
        <div className="flex h-full w-fit flex-col gap-4">
          {isExaiphanesBlade(name) ? (
            // Same three rows, in the same order, as every other weapon
            // below -- just with Level and Refinement as plain read-only
            // values (no slider) instead of their own independent
            // controls, since neither is actually settable on its own for
            // this weapon. Statues Unlocked takes Ascension's own slot
            // and styling (same space-y-1/label/DiamondSelector, even the
            // same 6-diamond count) since it's the one real control here,
            // driving level/ascension/refinement together (see
            // EXAIPHANES_BLADE_STATES) -- clicking it updates the Level
            // and Refinement rows' own displayed values along with it.
            <>
              <div className="flex items-center gap-2 text-sm">
                Level
                <span className="w-14">
                  {level}/{maxLevelForAscensionPhase(ascensionPhase)}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-sm">Statues Unlocked</p>
                <DiamondSelector
                  count={EXAIPHANES_BLADE_STATES.length - 1}
                  value={statuesUnlocked}
                  onChange={handleStatuesUnlockedChange}
                  litClassName="border-amber-400 bg-amber-400"
                  ariaLabel={(n) => `${n} statues unlocked`}
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                Refinement
                <span className="w-8">R{refinement}</span>
              </div>
            </>
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
                <span className="w-14">
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
                <span className="w-8">R{refinement}</span>
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

          {/* -mr-9 -- same alignment trick as BaseStatsSection/
              PassiveSection above, and as CharacterProgressionEditor's own
              button row, so the Save/Add button lands flush with the
              close button instead of stopping short at the pr-14 gap.
              mt-auto pushes this row to the bottom of the column (see the
              wrapper's own comment above) instead of sitting wherever it
              happens to land right after the content. */}
          <div className="-mr-9 mt-auto flex items-center justify-end gap-2 border-t pt-3">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete weapon
              </button>
            )}
            <button
              type="button"
              onClick={() => onSubmit({ level, ascensionPhase, refinement })}
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
