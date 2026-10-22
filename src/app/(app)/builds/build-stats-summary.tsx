"use client";

import Image from "next/image";
import { type Element, TalentSlot } from "@/generated/prisma/enums";
import { formatStatValue } from "@/lib/stat-format";
import { elementGlowClasses } from "@/lib/element-colors";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import { TaggedText } from "@/components/tagged-text";
import { computeFinalStats, orderedFinalStats, FINAL_STATS_PRIMARY_ORDER } from "./final-stats";
import type { OwnedArtifactOption, OwnedCharacterOption, OwnedWeaponOption } from "./filter-sort";

type TalentOption = OwnedCharacterOption["talents"][number];
type ConstellationOption = OwnedCharacterOption["constellations"][number];

// Same circular icon + hover tooltip (name + description, TaggedText for
// its <gold>/<element> highlight tags) the character progression editor's
// own TooltipIcon uses for every talent -- `level` renders as a small
// corner badge for the 3 combat talents (the editor shows theirs next to a
// slider instead, which doesn't apply to this read-only summary);
// undefined for a Passive, which has no level to show, same as the
// editor's own PassiveTalentIcon.
function TalentIcon({ talent, level }: { talent: TalentOption; level?: number }) {
  return (
    <MouseFollowTooltip
      content={
        <>
          <p className="text-base font-semibold text-yellow-100">{talent.name}</p>
          <p className="mt-1.5 whitespace-pre-line text-gray-300">
            <TaggedText text={talent.description} />
          </p>
        </>
      }
    >
      <div className="relative h-9 w-9">
        {/* overflow-hidden lives on this INNER wrapper (clipping the icon
            art into a circle) rather than the outer relative div -- the
            level badge below is a sibling of this, not a child, so it
            isn't clipped by it, and can hang at the circle's own bottom
            point. */}
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gray-600 bg-black/30">
          {talent.iconUrl && <Image src={talent.iconUrl} alt={talent.name} width={30} height={30} />}
        </div>
        {level !== undefined && (
          // Plain text, no badge background/border -- just the number,
          // centered at the circle's own bottom point.
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold leading-none text-white">
            {level}
          </span>
        )}
      </div>
    </MouseFollowTooltip>
  );
}

// Same lit/unlit treatment as the editor's own ConstellationIcons -- lit
// (unlocked) uses the character's own element glow border and full-color
// art, unlit is grayscaled and dimmed. Read-only here (no onClick/toggle),
// since this box only ever reflects the character's own saved progression.
function ConstellationIcon({
  constellation,
  lit,
  element,
}: {
  constellation: ConstellationOption;
  lit: boolean;
  element: Element;
}) {
  return (
    <MouseFollowTooltip
      content={
        <>
          <p className="text-base font-semibold text-yellow-100">
            C{constellation.number} · {constellation.name}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-gray-300">
            <TaggedText text={constellation.description} />
          </p>
        </>
      }
    >
      <div
        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 ${
          lit ? elementGlowClasses(element) : "border-gray-600 bg-black/30 opacity-50 grayscale"
        }`}
      >
        {constellation.iconUrl && (
          <Image src={constellation.iconUrl} alt={constellation.name} width={30} height={30} />
        )}
      </div>
    </MouseFollowTooltip>
  );
}

// The 4 dark summary boxes (Character Stats / Talents / Constellations /
// Artifact Set Effects) shown below the weapon/artifact pickers on both the
// create-build page and the owned-builds edit modal -- extracted here once
// the edit modal needed the exact same summary a second call site, same as
// this app's own useToast/Toast extraction once a second page needed that
// pattern. Always expects a real character (both call sites only render
// this once one is chosen/locked in), unlike BuildCatalog's own earlier
// `character &&` guard around this same JSX.
export function BuildStatsSummary({
  character,
  weapon,
  artifacts,
}: {
  character: OwnedCharacterOption;
  weapon: OwnedWeaponOption | null;
  artifacts: OwnedArtifactOption[];
}) {
  // Recomputed on every render from whatever's currently picked -- cheap
  // enough (a handful of stat rows summed across at most 1 weapon + 5
  // artifacts) that memoizing would be premature. See final-stats.ts's own
  // comment on what this totals (and deliberately doesn't).
  const finalStats = orderedFinalStats(computeFinalStats({ character, weapon, artifacts }));

  // The 7 "necessary" stats (HP/ATK/DEF/EM/Crit Rate/Crit DMG/ER) --
  // always present in finalStats (see FINAL_STATS_PRIMARY_ORDER's own
  // comment), shown directly on the Character Stats box's own face. Every
  // other computed stat (elemental DMG%/RES%, Healing Bonus%, Shield
  // Strength%, ...) only shows up when it's actually nonzero for this
  // build, so it moves to the hover-only full list instead of competing
  // for space on the box face for what's usually nothing.
  const primaryStats = FINAL_STATS_PRIMARY_ORDER.map((statName) => finalStats.find((s) => s.statName === statName)).filter(
    (s): s is { statName: string; value: number } => s !== undefined
  );

  // The 3 combat talents, each paired with its own level, in the same
  // fixed order the progression editor shows them in.
  const combatTalents = [
    { slot: TalentSlot.NormalAttack, level: character.normalAttackLevel },
    { slot: TalentSlot.Skill, level: character.skillLevel },
    { slot: TalentSlot.Burst, level: character.burstLevel },
  ]
    .map(({ slot, level }) => {
      const talent = character.talents.find((t) => t.slot === slot);
      return talent ? { talent, level } : undefined;
    })
    .filter((t): t is { talent: TalentOption; level: number } => t !== undefined);

  // Every Passive, in slot order -- no level to pair with these, same as
  // the editor's own PassiveTalentIcon.
  const passiveTalents = character.talents.filter(
    (t) => t.slot !== TalentSlot.NormalAttack && t.slot !== TalentSlot.Skill && t.slot !== TalentSlot.Burst
  );

  // One entry per distinct equipped set with 2+ pieces (not one per
  // threshold -- a 4-piece set already implies its own 2pc bonus too, so
  // it gets a single "<set name> 4" entry covering both, rather than two
  // separate "<set name> 2"/"<set name> 4" entries for the same set).
  // twoPieceEffect/fourPieceEffect carry the real effect TEXT -- not just
  // the stat-bonus subset final-stats.ts totals, since most 4pc effects
  // (and some 2pc ones) are conditional/proc-based and have no stat bonus
  // row at all. Mirrors final-stats.ts's own setPieceCounts grouping.
  const activeSetEffects = (() => {
    const counts = new Map<number, number>();
    for (const artifact of artifacts) {
      counts.set(artifact.artifactSetId, (counts.get(artifact.artifactSetId) ?? 0) + 1);
    }
    const seenSets = new Set<number>();
    const effects: { setName: string; maxPiece: 2 | 4; twoPieceEffect: string; fourPieceEffect: string | null }[] = [];
    for (const artifact of artifacts) {
      if (seenSets.has(artifact.artifactSetId)) continue;
      seenSets.add(artifact.artifactSetId);
      const count = counts.get(artifact.artifactSetId) ?? 0;
      if (count < 2) continue;
      const hasFourPiece = count >= 4 && artifact.fourPieceEffect !== null;
      effects.push({
        setName: artifact.setName,
        maxPiece: hasFourPiece ? 4 : 2,
        twoPieceEffect: artifact.twoPieceEffect,
        fourPieceEffect: hasFourPiece ? artifact.fourPieceEffect : null,
      });
    }
    return effects;
  })();

  return (
    <div className="mt-4 flex h-full gap-3">
      {/* Column 1: Character Stats -- a narrow vertical list of just the 7
          "necessary" stats (FINAL_STATS_PRIMARY_ORDER), not the full grid
          this used to always show. Hovering the whole box reveals every
          computed stat instead, same single-tooltip-for-the-whole-box
          pattern Artifact Set Effects already uses below. h-full here
          (fed by the caller's own min-h-0 flex-1 wrapper -- see
          BuildCatalog/BuildEditor's own comment) stretches this box all
          the way down to match the character splash art's own height,
          not column 2's height -- column 2 opts out via self-start below,
          since it should stay exactly as tall as its own 3 boxes. */}
      <MouseFollowTooltip
        wrapperClassName="relative block h-full w-64 shrink-0"
        content={
          finalStats.length === 0 ? (
            <p className="text-gray-300">No stats yet.</p>
          ) : (
            <>
              <p className="text-base font-semibold text-yellow-100">Full Stats</p>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 whitespace-nowrap text-gray-300">
                {finalStats.map(({ statName, value }) => (
                  <li key={statName}>
                    {statName}: {formatStatValue(statName, value)}
                  </li>
                ))}
              </ul>
            </>
          )
        }
      >
        <div className="flex h-full flex-col rounded border bg-black p-4 text-base">
          <p className="text-lg font-semibold text-foreground">Character Stats</p>
          {primaryStats.length === 0 ? (
            <p className="mt-2 text-gray-400">No stats yet.</p>
          ) : (
            // flex-1 + justify-between (not a fixed gap) -- spreads the 7
            // stats evenly across whatever height h-full above actually
            // ends up giving this box (tracking the splash art's own
            // height), instead of bunching at the top with growing dead
            // space below as that height grows.
            <ul className="mt-5 flex flex-1 flex-col justify-between whitespace-nowrap">
              {primaryStats.map(({ statName, value }) => (
                <li key={statName}>
                  {statName}: {formatStatValue(statName, value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </MouseFollowTooltip>

      {/* Column 2: Talents / Constellations / Artifact Set Effects, each
          its own full-width "horizontal" box (wide icon row, not square)
          stacked vertically -- replaces the earlier 3-across grid row now
          that Character Stats is its own narrow column alongside this one
          rather than a full-width row above it. self-start -- opts out of
          this row's own stretch (which Column 1 uses, see its own
          comment), so this stays exactly as tall as its own 3 boxes
          instead of stretching down to match them with empty space
          inside each box. */}
      <div className="flex flex-1 flex-col gap-3 self-start">
        <div className="rounded border bg-black p-4 text-base">
          <p className="text-lg font-semibold text-foreground">Talents</p>
          {/* Same icon row the progression editor's own
              TalentsSection uses -- combat talents (with their
              own level, as a corner badge) first, then Passives
              (no level), both in one row since this summary
              doesn't need the editor's own sliders/spacing. */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {combatTalents.map(({ talent, level }) => (
              <TalentIcon key={talent.slot} talent={talent} level={level} />
            ))}
            {passiveTalents.map((talent) => (
              <TalentIcon key={talent.slot} talent={talent} />
            ))}
          </div>
        </div>

        <div className="rounded border bg-black p-4 text-base">
          <p className="text-lg font-semibold text-foreground">Constellations</p>
          {/* Same lit/unlit icon row as the editor's own
              ConstellationIcons -- always all 6, not just the
              unlocked ones, so the row also shows at a glance
              how many are left. */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {character.constellations.map((c) => (
              <ConstellationIcon
                key={c.number}
                constellation={c}
                lit={c.number <= character.constellation}
                element={character.element}
              />
            ))}
          </div>
        </div>

        {activeSetEffects.length === 0 ? (
          <div className="rounded border bg-black p-4 text-base">
            <p className="text-lg font-semibold text-foreground">Artifact Set Effects</p>
            <p className="mt-2 text-gray-400">No 2-piece or 4-piece set bonus active yet.</p>
          </div>
        ) : (
          // One tooltip for the WHOLE box -- hovering anywhere over it
          // shows every active set's full 2pc/4pc text at once, rather
          // than needing to hover each name individually to see its own.
          <MouseFollowTooltip
            wrapperClassName="relative block"
            content={
              <div className="space-y-3">
                {activeSetEffects.map((effect, index) => (
                  <div key={effect.setName}>
                    {index > 0 && <hr className="mb-3 border-gray-700" />}
                    <p className="text-base font-semibold text-yellow-100">{effect.setName}</p>
                    <p className="mt-1 text-gray-300">
                      <span className="font-semibold text-yellow-100">2pc: </span>
                      {effect.twoPieceEffect}
                    </p>
                    {effect.fourPieceEffect && (
                      <p className="mt-2 text-gray-300">
                        <span className="font-semibold text-yellow-100">4pc: </span>
                        {effect.fourPieceEffect}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            }
          >
            <div className="rounded border bg-black p-4 text-base">
              <p className="text-lg font-semibold text-foreground">Artifact Set Effects</p>
              {/* One set per row -- just the set name + its own
                  highest piece threshold, no individual hover
                  here anymore, see the single box-wide tooltip
                  above. */}
              <ul className="mt-2 flex flex-col gap-y-1">
                {activeSetEffects.map((effect) => (
                  <li key={effect.setName} className="flex items-center gap-1.5 text-foreground">
                    {/* mt-0.5 -- same fix used elsewhere in
                        this app for a badge sitting next to
                        plain text: Arial's own line-height
                        metrics aren't split evenly above/
                        below the glyphs, so items-center
                        alone still left this text reading
                        slightly above true center next to
                        the badge. */}
                    <span className="mt-0.5">{effect.setName}</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-600 bg-black/70 text-xs font-semibold leading-none text-white">
                      {effect.maxPiece}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </MouseFollowTooltip>
        )}
      </div>
    </div>
  );
}
