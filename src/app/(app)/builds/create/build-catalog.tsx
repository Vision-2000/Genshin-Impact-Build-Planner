"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArtifactSlot, type Element, TalentSlot } from "@/generated/prisma/enums";
import { useToast, Toast } from "@/components/toast";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { formatStatValue } from "@/lib/stat-format";
import { elementGlowClasses } from "@/lib/element-colors";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import { TaggedText } from "@/components/tagged-text";
import { createBuild } from "../actions";
import { ArtifactSlotPicker } from "../artifact-slot-picker";
import { CharacterSlotPicker } from "../character-slot-picker";
import { WeaponSlotPicker } from "../weapon-slot-picker";
import { computeFinalStats, orderedFinalStats } from "../final-stats";
import type { CreateBuildErrors } from "../schemas";
import type { OwnedArtifactOption, OwnedCharacterOption, OwnedWeaponOption } from "../filter-sort";

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

const SLOTS = Object.values(ArtifactSlot);

// Weapon + all 5 artifact slots share one row here (unlike their own usual
// 224x224, each on its own row/section) -- 5vw scales continuously with
// the viewport's own width instead of jumping between fixed breakpoint
// sizes, while still leaving enough room for all 6 boxes (plus the
// character splash column and its own padding) to stay on that one line
// rather than wrapping. vw for BOTH dimensions, not vh for height -- this
// keeps the box square regardless of viewport aspect ratio, since vh
// would instead tie its height to viewport HEIGHT, independent of width.
const SLOT_SIZE_CLASS = "h-[9vw] w-[9vw]";

type SlotSelections = Partial<Record<ArtifactSlot, number>>;
// Same per-slot shape as SlotSelections, one open/closed flag per artifact
// slot instead of one chosen piece -- there are 5 independent
// ArtifactSlotPicker instances, so a single shared boolean (like
// weaponPickerOpen) couldn't say WHICH one to reopen.
type SlotOpenState = Partial<Record<ArtifactSlot, boolean>>;

type Draft = {
  characterId: number | null;
  name: string;
  weaponId: number | null;
  slots: SlotSelections;
  characterPickerOpen: boolean;
  weaponPickerOpen: boolean;
  artifactPickerOpenSlots: SlotOpenState;
};

// Leaving the page to add a missing character/weapon/artifact (via a
// picker's own "add it" link) is a full navigation, which unmounts this
// component -- so the in-progress draft is stashed in sessionStorage and
// restored on mount, surviving both a browser Back and a manual refresh
// (needed anyway for the newly-added owned item to show up in its picker).
export const DRAFT_KEY = "build-catalog-draft";

function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

// One blank build at a time -- rather than a list of every owned character
// to expand (the earlier design), the page starts empty with every field
// (character/name/weapon/artifacts) immediately available, in any order,
// using the same slot-picker pattern (click a box, pick from a grid) for
// all three kinds of owned data CharacterSlotPicker/WeaponSlotPicker/
// ArtifactSlotPicker already establish. Weapon candidates just aren't
// narrowed to one type until a character is actually chosen (see
// WeaponSlotPicker's own null-weaponType handling) -- nothing is gated
// behind filling in an earlier field first. Saving resets back to another
// blank build, so creating several in a row doesn't require re-navigating
// here each time.
export function BuildCatalog({
  characters,
  weapons,
  artifacts,
}: {
  characters: OwnedCharacterOption[];
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
}) {
  useRefreshOnBackNavigation();
  const [, startTransition] = useTransition();
  const { message, visible, showToast } = useToast();

  // Always start from the SSR-safe default -- reading sessionStorage inside
  // a useState initializer would run during hydration too (window exists on
  // the client but not the server), making the client's first render differ
  // from what the server sent. Restoring happens in an effect instead, which
  // only ever runs post-hydration.
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [weaponId, setWeaponId] = useState<number | null>(null);
  const [slots, setSlots] = useState<SlotSelections>({});
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [weaponPickerOpen, setWeaponPickerOpen] = useState(false);
  const [artifactPickerOpenSlots, setArtifactPickerOpenSlots] = useState<SlotOpenState>({});
  const [errors, setErrors] = useState<CreateBuildErrors>({});

  // Runs once, right after the initial (SSR-matching) render: apply a
  // restored draft, if any. This is a deliberate exception to
  // react-hooks/set-state-in-effect -- restoring state from an external
  // store (sessionStorage) on mount is the "synchronize with an external
  // system" case the hook is meant for, not the "derived state"
  // anti-pattern the rule targets.
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      // The rule only needs one exception per effect -- the calls below are
      // batched into the same cascading render as this one.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCharacterId(draft.characterId);
      setName(draft.name);
      setWeaponId(draft.weaponId);
      setSlots(draft.slots);
      setCharacterPickerOpen(draft.characterPickerOpen);
      setWeaponPickerOpen(draft.weaponPickerOpen);
      setArtifactPickerOpenSlots(draft.artifactPickerOpenSlots);
      // Freshness of characters/weapons/artifacts after returning here (e.g.
      // via Back after following a picker's own "add it" link) is handled
      // by useRefreshOnBackNavigation() above, which refetches on browser
      // Back/Forward regardless of this draft-restore path.
    }
  }, []);

  // Persisted whenever the draft has anything worth keeping, and cleared
  // once it doesn't (a fresh page load, or right after resetForm() below
  // following a successful save).
  useEffect(() => {
    const isEmpty = characterId === null && name === "" && weaponId === null && Object.keys(slots).length === 0;
    if (isEmpty) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: Draft = {
      characterId,
      name,
      weaponId,
      slots,
      characterPickerOpen,
      weaponPickerOpen,
      artifactPickerOpenSlots,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [characterId, name, weaponId, slots, characterPickerOpen, weaponPickerOpen, artifactPickerOpenSlots]);

  const character = characterId !== null ? characters.find((c) => c.ownedCharacterId === characterId) : undefined;
  const weapon = weaponId !== null ? weapons.find((w) => w.ownedWeaponId === weaponId) : undefined;
  const selectedArtifacts = SLOTS.map((slot) => {
    const ownedArtifactId = slots[slot];
    return ownedArtifactId !== undefined ? artifacts.find((a) => a.ownedArtifactId === ownedArtifactId) : undefined;
  }).filter((a): a is OwnedArtifactOption => a !== undefined);

  // Recomputed on every render from whatever's currently picked -- cheap
  // enough (a handful of stat rows summed across at most 1 weapon + 5
  // artifacts) that memoizing would be premature. See final-stats.ts's own
  // comment on what this totals (and deliberately doesn't).
  const finalStats = character
    ? orderedFinalStats(
        computeFinalStats({
          character,
          weapon: weapon ?? null,
          artifacts: selectedArtifacts,
        })
      )
    : [];

  // The 3 combat talents, each paired with its own level, in the same
  // fixed order the progression editor shows them in.
  const combatTalents = character
    ? [
        { slot: TalentSlot.NormalAttack, level: character.normalAttackLevel },
        { slot: TalentSlot.Skill, level: character.skillLevel },
        { slot: TalentSlot.Burst, level: character.burstLevel },
      ]
        .map(({ slot, level }) => {
          const talent = character.talents.find((t) => t.slot === slot);
          return talent ? { talent, level } : undefined;
        })
        .filter((t): t is { talent: TalentOption; level: number } => t !== undefined)
    : [];

  // Every Passive, in slot order -- no level to pair with these, same as
  // the editor's own PassiveTalentIcon.
  const passiveTalents = character
    ? character.talents.filter((t) => t.slot !== TalentSlot.NormalAttack && t.slot !== TalentSlot.Skill && t.slot !== TalentSlot.Burst)
    : [];

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
    for (const artifact of selectedArtifacts) {
      counts.set(artifact.artifactSetId, (counts.get(artifact.artifactSetId) ?? 0) + 1);
    }
    const seenSets = new Set<number>();
    const effects: { setName: string; maxPiece: 2 | 4; twoPieceEffect: string; fourPieceEffect: string | null }[] = [];
    for (const artifact of selectedArtifacts) {
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

  function resetForm() {
    setCharacterId(null);
    setName("");
    setWeaponId(null);
    setSlots({});
    setCharacterPickerOpen(false);
    setWeaponPickerOpen(false);
    setArtifactPickerOpenSlots({});
    setErrors({});
  }

  function handleCharacterChange(nextCharacterId: number | null) {
    // A different character (or clearing back to none) can mean a
    // different weapon type -- an already-chosen weapon might not even be
    // the right type anymore, so clear it (and the weapon picker's own
    // open state) rather than silently carry over a mismatched choice.
    // Artifacts aren't character-specific, so they're left alone.
    setCharacterId(nextCharacterId);
    setWeaponId(null);
    setWeaponPickerOpen(false);
  }

  function handleSubmit() {
    if (!character) return;

    const artifactEntries = SLOTS.map((slot) => ({ slot, ownedArtifactId: slots[slot] })).filter(
      (entry): entry is { slot: ArtifactSlot; ownedArtifactId: number } => entry.ownedArtifactId !== undefined
    );

    startTransition(async () => {
      const result = await createBuild({
        ownedCharacterId: character.ownedCharacterId,
        name,
        ownedWeaponId: weaponId,
        artifacts: artifactEntries,
      });

      if ("errors" in result) {
        setErrors(result.errors);
        return;
      }

      showToast(
        <>
          Created <span className="font-bold">{result.build.name}</span> for {character.name}
        </>
      );
      resetForm();
    });
  }

  return (
    <div className="space-y-4">
      {characters.length === 0 ? (
        <p className="text-sm text-gray-500">
          Own a character on the{" "}
          <Link href="/characters" className="underline hover:text-foreground">
            Characters page
          </Link>{" "}
          before creating a build.
        </p>
      ) : (
        // A plain div, not a Fragment -- the outer space-y-4 would
        // otherwise add its own gap between this and the two-column body
        // below, same as it does between any other pair of top-level
        // siblings; wrapping them here keeps the two flush against each
        // other instead.
        <div>
          {/* Dedicated top row -- name and the final submit action are
              form-level concerns, not part of any one slot, so they get
              their own row above the character/weapon/artifact pickers
              rather than sitting at the bottom of the (now two-column)
              body below. */}
          <div className="flex flex-wrap items-end justify-between gap-3 rounded border p-4">
            <div>
              <label className="block text-sm">
                Name:
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="ml-1 h-8 rounded border bg-white px-2 text-sm text-black"
                />
              </label>
              {errors.name && <p className="text-xs text-red-600">{errors.name[0]}</p>}
              {errors.ownedCharacterId && <p className="text-xs text-red-600">{errors.ownedCharacterId[0]}</p>}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!character}
              className="rounded border border-white bg-black px-3 py-1 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Save build
            </button>
          </div>

          {/* flex-row (sm+) puts the character splash (see
              CharacterSlotPicker) as its own left column, same two-column
              shape the character/weapon progression editors use, rather
              than treating it as just one more same-sized slot among the
              others -- though unlike this row, CharacterSlotPicker's own
              height is a fixed aspect ratio now, not stretched to match
              this row's own height. */}
          <div className="flex w-full flex-col overflow-hidden rounded border sm:flex-row">
            <CharacterSlotPicker
              characters={characters}
              value={characterId}
              onChange={handleCharacterChange}
              autoOpen={characterPickerOpen}
              onOpenChange={setCharacterPickerOpen}
            />

            {/* pt-2 (not p-4's own top value) -- matches CharacterSlotPicker's
                own "Character" label's pt-2 exactly, so its text and this
                column's own "Weapon"/"Artifacts" labels -- and the slot
                boxes right below them -- line up at the same height instead
                of sitting 8px lower under p-4's fuller top padding. */}
            <div className="flex-1 px-4 pb-4 pt-2">
              {/* Weapon and Artifacts keep their own separate labels, each
                  directly above its own box(es), but both groups sit side
                  by side in one flex row -- compact (boxSizeClassName, down
                  from the usual 224x224) enough that the boxes themselves
                  still land on one shared line. */}
              <div className="flex flex-wrap gap-8">
                <div>
                  {/* mb-1 -- matches CharacterSlotPicker's own gap-1 between
                      its "Character" label and its box, so the boxes line
                      up at the same height too, not just the label text. */}
                  <p className="mb-1 text-sm font-medium">Weapon</p>
                  <WeaponSlotPicker
                    // null until a character is chosen -- WeaponSlotPicker
                    // then shows every owned weapon regardless of type
                    // instead of narrowing to one (see its own comment), so
                    // this field is usable right away rather than waiting
                    // on the character field above it.
                    weaponType={character?.weaponType ?? null}
                    weapons={weapons}
                    value={weaponId}
                    onChange={setWeaponId}
                    autoOpen={weaponPickerOpen}
                    onOpenChange={setWeaponPickerOpen}
                    boxSizeClassName={SLOT_SIZE_CLASS}
                    // "" -- the usual 8px gray border reads as too thick at
                    // this compact size.
                    cardBorderClassName=""
                  />
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">Artifacts</p>
                  <div className="flex gap-2">
                    {SLOTS.map((slot) => (
                      <ArtifactSlotPicker
                        key={slot}
                        slot={slot}
                        artifacts={artifacts}
                        value={slots[slot] ?? null}
                        onChange={(ownedArtifactId) =>
                          setSlots((prev) => ({ ...prev, [slot]: ownedArtifactId ?? undefined }))
                        }
                        autoOpen={artifactPickerOpenSlots[slot] ?? false}
                        onOpenChange={(open) =>
                          setArtifactPickerOpenSlots((prev) => ({ ...prev, [slot]: open }))
                        }
                        boxSizeClassName={SLOT_SIZE_CLASS}
                        // Icon only, no border -- matches the Weapon slot's
                        // own plain-icon treatment at this size. Main stat/
                        // substats/level are still shown, via the level
                        // badge and hover tooltip ArtifactSlotPicker's own
                        // selected display always provides now (see its
                        // own comment).
                        cardBorderClassName=""
                      />
                    ))}
                  </div>
                </div>
              </div>

              {character && (
                <>
                  {/* Same dark stat box treatment as the character progression
                      editor's own BaseStatsSection (owned-character-manager.tsx)
                      -- rounded bg-black box, "Stats" header, "Name: value"
                      lines -- rather than this page's earlier ad hoc dt/dd grid.
                      No StatLine ghost-text sizing trick here, unlike that box:
                      that trick exists to stop the box reflowing as a slider is
                      dragged continuously, which doesn't apply to this page's
                      discrete character/weapon/artifact picks. */}
                  <div className="mt-4 rounded border bg-black p-3 text-sm">
                    <p className="font-medium text-foreground">Character Stats</p>
                    {finalStats.length === 0 ? (
                      <p className="mt-1 text-gray-400">No stats yet.</p>
                    ) : (
                      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 whitespace-nowrap sm:grid-cols-3 md:grid-cols-4">
                        {finalStats.map(({ statName, value }) => (
                          <li key={statName}>
                            {statName}: {formatStatValue(statName, value)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Three more boxes, same dark treatment as Stats above --
                      the character's own talents, their own constellations,
                      and the build's currently-active artifact set effects
                      (if any). grid-cols-1 below sm stacks them instead of
                      squeezing all three onto one cramped row. No "Lv. X/Y"
                      line repeated in any of these -- that's shown directly
                      on the splash art itself (CharacterSlotPicker's own
                      top-left level badge). No items-start here -- a plain
                      grid row's default stretch keeps all three the same
                      height (the row's tallest), which is what we want now
                      that Artifact Set Effects' own content is just a
                      compact flex-wrap row of short entries, same scale as
                      Talents/Constellations' own icon row. */}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded border bg-black p-3 text-sm">
                      <p className="font-medium text-foreground">Talents</p>
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

                    <div className="rounded border bg-black p-3 text-sm">
                      <p className="font-medium text-foreground">Constellations</p>
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
                      <div className="flex h-full flex-col rounded border bg-black p-3 text-sm">
                        <p className="font-medium text-foreground">Artifact Set Effects</p>
                        <p className="mt-2 flex flex-1 items-center text-gray-400">
                          No 2-piece or 4-piece set bonus active yet.
                        </p>
                      </div>
                    ) : (
                      // One tooltip for the WHOLE box now, not one per set
                      // name -- hovering anywhere over the box shows every
                      // active set's full 2pc/4pc text at once, rather than
                      // needing to hover each name individually to see its
                      // own. wrapperClassName keeps this a block that fills
                      // its grid cell (MouseFollowTooltip's own default,
                      // "relative inline-block", would otherwise size to
                      // its content instead of stretching like the other
                      // two boxes in this row).
                      <MouseFollowTooltip
                        wrapperClassName="relative block h-full"
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
                        <div className="flex h-full flex-col rounded border bg-black p-3 text-sm">
                          <p className="font-medium text-foreground">Artifact Set Effects</p>
                          {/* One set per row, always -- not flex-wrap
                              (which previously put 2 sets side by side on
                              one row whenever they both fit). Each line is
                              now just the set name + its own highest piece
                              threshold -- no individual hover here anymore,
                              see the single box-wide tooltip above. */}
                          <ul className="mt-2 flex flex-1 flex-col justify-center gap-y-1">
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast message={message} visible={visible} />
    </div>
  );
}
