"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { Modal } from "@/components/modal";
import { createBuild } from "./actions";
import { ArtifactSlotPicker } from "./artifact-slot-picker";
import { CharacterSlotPicker } from "./character-slot-picker";
import { WeaponSlotPicker } from "./weapon-slot-picker";
import { BuildStatsSummary } from "./build-stats-summary";
import type { CreateBuildErrors } from "./schemas";
import type { BuildItem, OwnedArtifactOption, OwnedCharacterOption, OwnedWeaponOption } from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);

// Weapon + all 5 artifact slots share one row here (unlike their own usual
// 224x224, each on its own row/section) -- a compact aspect-square box
// that fills its own grid column (see the grid-cols-6 row below) instead
// of a fixed pixel size, so all 6 boxes shrink together with the Modal's
// own width (which still narrows on small screens despite being width-
// capped) rather than the artifact group wrapping below Weapon once a
// fixed-width row stopped fitting.
const SLOT_SIZE_CLASS = "aspect-square w-full";

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
// component (it lives inside OwnedBuildManager's own "create build" modal,
// not its own route) -- so the in-progress draft is stashed in
// sessionStorage and restored on mount, surviving both a browser Back and
// a manual refresh (needed anyway for the newly-added owned item to show
// up in its picker). OwnedBuildManager's own mount effect checks for a
// leftover draft too, to decide whether to reopen this modal at all in the
// first place -- this component only restores the FIELD values once it's
// already been mounted.
export const DRAFT_KEY = "build-catalog-draft";

export function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

// One blank build at a time -- rather than a list of every owned character
// to expand (the earlier design), the form starts empty with every field
// (character/name/weapon/artifacts) immediately available, in any order,
// using the same slot-picker pattern (click a box, pick from a grid) for
// all three kinds of owned data CharacterSlotPicker/WeaponSlotPicker/
// ArtifactSlotPicker already establish. Weapon candidates just aren't
// narrowed to one type until a character is actually chosen (see
// WeaponSlotPicker's own null-weaponType handling) -- nothing is gated
// behind filling in an earlier field first. Saving closes the modal
// (onCreated reports the new build to the caller, which adds it to the
// owned-builds list this modal was covering) rather than resetting back
// to another blank form and staying open -- creating several builds in a
// row means reopening this each time, a deliberate tradeoff for always
// landing back on the list with the just-created build now visible in it.
export function BuildCatalog({
  characters,
  weapons,
  artifacts,
  onCreated,
  onClose,
}: {
  characters: OwnedCharacterOption[];
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  onCreated: (build: BuildItem) => void;
  // BuildCatalog owns its own Modal (always open while mounted) rather
  // than a caller wrapping it in one -- OwnedBuildManager only mounts this
  // component while its own "create build" state is true, same as it
  // already does for BuildEditor, so there's nothing left for an `open`
  // prop to say that mounting it didn't already say. onClose still comes
  // from the caller, since closing means unmounting this (and letting a
  // leftover draft resurface via OwnedBuildManager's own restore effect),
  // not something this component can do to itself.
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();

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
      // by OwnedBuildManager's own useRefreshOnBackNavigation(), which
      // refetches on browser Back/Forward regardless of this draft-restore
      // path.
    }
  }, []);

  // Persisted whenever the draft has anything worth keeping, and cleared
  // once it doesn't (a fresh mount) -- a successful save clears it a
  // different way, via handleClose() directly removing the sessionStorage
  // entry rather than through this effect, since the whole component
  // unmounts right after (see handleSubmit's own comment).
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

  function handleCharacterChange(nextCharacterId: number | null) {
    // A different character (or clearing back to none) can mean a
    // different weapon type -- an already-chosen weapon might not even be
    // the right type anymore, so clear it (and the weapon picker's own
    // open state) rather than silently carry over a mismatched choice.
    setCharacterId(nextCharacterId);
    setWeaponId(null);
    setWeaponPickerOpen(false);
    // Artifacts aren't character-specific -- switching between two real
    // characters leaves them alone, same as before. But clearing back to
    // NO character disables the artifact pickers entirely (see
    // ArtifactSlotPicker's own disabled prop below), so any already-
    // chosen pieces are cleared too rather than leaving a selection the
    // UI no longer lets you see or change.
    if (nextCharacterId === null) {
      setSlots({});
      setArtifactPickerOpenSlots({});
    }
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

      onCreated(result.build);
      // Closes the modal (and clears the draft, same as an explicit
      // close -- see handleClose's own comment) instead of resetting
      // the form in place and staying open. The newly created build is
      // now directly visible in the owned-builds list behind this
      // modal, which is reason enough on its own to close rather than
      // require a second explicit close to see it.
      handleClose();
    });
  }

  // Explicit close (backdrop click, Escape, a future close button) --
  // not the same as unmounting by navigating away via a picker's own
  // "add it" link, which leaves the sessionStorage draft alone on
  // purpose so returning via Back still restores it (see DRAFT_KEY's own
  // comment and OwnedBuildManager's own restore effect). An explicit
  // close means the user is done with this draft, so it's cleared here
  // too -- otherwise it would silently resurrect itself (reopening this
  // modal half-filled) the next time OwnedBuildManager mounts, including
  // on a plain page refresh, not just a Back navigation.
  function handleClose() {
    sessionStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  // Smaller than Modal's own h-10 close button (h-7, tighter px) -- same
  // sizing as BuildEditor's own headerActions button, and BuildDetailModal's
  // before that (both owned-build-manager.tsx/build-detail-modal.tsx).
  const headerButtonClassName = "flex h-7 items-center whitespace-nowrap rounded border px-2 text-xs font-semibold";

  return (
    <Modal
      open
      onClose={handleClose}
      maxWidthClassName="max-w-7xl"
      // The editable Name field itself, not a static heading -- same
      // reasoning as BuildEditor's own identical title now uses
      // (owned-build-manager.tsx): there's no fixed character/build
      // identity to show yet at this point, since picking a character is
      // part of this same form. font-normal on the input overrides the
      // title row's own font-semibold, which would otherwise bold the
      // typed text too.
      title={
        <label className="flex items-center gap-2">
          <span>Name:</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border bg-white px-2 py-1 text-sm font-normal text-black"
          />
        </label>
      }
      headerActions={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!character}
          className={`${headerButtonClassName} border-white bg-black text-white hover:bg-gray-800 disabled:opacity-50`}
        >
          Save build
        </button>
      }
    >
      <div className="space-y-4">
        {characters.length === 0 ? (
          <p className="text-base text-gray-300">
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
            {/* Name/Save's own validation errors -- the fields themselves
                moved up into the Modal's title/headerActions (see above),
                but these still need to land somewhere visible, so they're
                the first thing in the body, right below. */}
            {(errors.name || errors.ownedCharacterId) && (
              <div className="mb-3 space-y-0.5">
                {errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}
                {errors.ownedCharacterId && <p className="text-sm text-red-600">{errors.ownedCharacterId[0]}</p>}
              </div>
            )}

            {/* flex-row (sm+) puts the character splash (see
                CharacterSlotPicker) as its own left column, same two-column
                shape the character/weapon progression editors use, rather
                than treating it as just one more same-sized slot among the
                others -- though unlike this row, CharacterSlotPicker's own
                height is a fixed aspect ratio now, not stretched to match
                this row's own height. */}
            <div className="flex w-full flex-col sm:flex-row">
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
              {/* pb-2 (not pb-4) -- matches CharacterSlotPicker's own
                  bottom padding exactly, so BuildStatsSummary's own
                  stretched h-full bottom edge (which now fills all the
                  way down to this padding, see its own comment) lands
                  flush with the splash art's bottom instead of stopping
                  8px short of it. */}
              <div className="flex flex-1 flex-col gap-4 px-4 pb-2 pt-2">
                {/* Weapon and Artifacts keep their own separate labels, each
                    directly above its own box(es), but both groups share one
                    grid-cols-6 row (1 column for Weapon, 5 for Artifacts) so
                    all 6 boxes scale down together as the row narrows instead
                    of the Artifacts group wrapping below Weapon as a block. */}
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-1">
                    {/* mb-1 -- matches CharacterSlotPicker's own gap-1 between
                        its "Character" label and its box, so the boxes line
                        up at the same height too, not just the label text. */}
                    <p className="mb-1 text-base font-bold">Weapon</p>
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
                      // border border-white (not the usual 8px gray) --
                      // thin enough not to read as too thick at this
                      // compact size, but still enough to mark where the
                      // card ends: its own bottom gradient overlay fades
                      // to near-black, which otherwise blends invisibly
                      // into the page's own black background.
                      cardBorderClassName="border border-white"
                    />
                  </div>

                  <div className="col-span-5">
                    <p className="mb-1 text-base font-bold">Artifacts</p>
                    <div className="grid grid-cols-5 gap-2">
                      {SLOTS.map((slot) => (
                        <ArtifactSlotPicker
                          key={slot}
                          slot={slot}
                          artifacts={artifacts}
                          value={slots[slot] ?? null}
                          onChange={(ownedArtifactId) =>
                            setSlots((prev) => ({ ...prev, [slot]: ownedArtifactId ?? undefined }))
                          }
                          // Same reasoning as WeaponSlotPicker's own
                          // weaponType={character?.weaponType ?? null} --
                          // nothing meaningful to pick until a character
                          // is actually chosen.
                          disabled={!character}
                          autoOpen={artifactPickerOpenSlots[slot] ?? false}
                          onOpenChange={(open) =>
                            setArtifactPickerOpenSlots((prev) => ({ ...prev, [slot]: open }))
                          }
                          boxSizeClassName={SLOT_SIZE_CLASS}
                          // border border-white -- same thin-border fix as
                          // the Weapon slot above, same reason (marks
                          // where the card ends against its own near-
                          // black bottom gradient). Main stat/substats/
                          // level are still shown, via the level badge
                          // and hover tooltip ArtifactSlotPicker's own
                          // selected display always provides now (see its
                          // own comment).
                          cardBorderClassName="border border-white"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {character && (
                  // min-h-0 -- without it, a flex child's default
                  // min-height:auto would floor this at its own content
                  // height, ignoring flex-1 whenever that content is
                  // shorter than the splash art next to it (the whole
                  // point here -- see BuildStatsSummary's own h-full).
                  <div className="min-h-0 flex-1">
                    <BuildStatsSummary character={character} weapon={weapon ?? null} artifacts={selectedArtifacts} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
