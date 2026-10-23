"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { Modal } from "@/components/modal";
import { useToast, Toast } from "@/components/toast";
import { createBuild } from "./actions";
import { ArtifactSlotPicker } from "./artifact-slot-picker";
import { CharacterSlotPicker } from "./character-slot-picker";
import { WeaponSlotPicker } from "./weapon-slot-picker";
import { BuildStatsSummary } from "./build-stats-summary";
import type { CreateBuildErrors } from "./schemas";
import type { BuildItem, OwnedArtifactOption, OwnedCharacterOption, OwnedWeaponOption } from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);

// Weapon + all 5 artifact slots share one row here (unlike their own usual
// 224x224, each on its own row/section) -- a fixed, compact size (not
// 224x224) leaves enough room for all 6 boxes (plus the character splash
// column and its own padding) to stay on that one line rather than
// wrapping. Fixed, not viewport-relative -- this form now always renders
// inside OwnedBuildManager's own width-capped "create build" Modal, same
// as BuildEditor's own EDITOR_SLOT_SIZE_CLASS there, not a full-width page
// a vw-based size could track.
const SLOT_SIZE_CLASS = "h-32 w-32";

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
// behind filling in an earlier field first. Saving resets back to another
// blank build (onCreated reports the new one to the caller, which adds it
// to the owned-builds list behind this modal) rather than closing the
// modal, so creating several in a row doesn't require reopening it each
// time.
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
      // by OwnedBuildManager's own useRefreshOnBackNavigation(), which
      // refetches on browser Back/Forward regardless of this draft-restore
      // path.
    }
  }, []);

  // Persisted whenever the draft has anything worth keeping, and cleared
  // once it doesn't (a fresh mount, or right after resetForm() below
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
      onCreated(result.build);
      resetForm();
    });
  }

  return (
    <Modal open onClose={onClose} maxWidthClassName="max-w-7xl" hideCloseButton>
      <div className="space-y-4">
        {characters.length === 0 ? (
          <p className="text-base text-gray-500">
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
                    className="ml-1 rounded border bg-white px-2 py-1 text-sm text-black"
                  />
                </label>
                {errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}
                {errors.ownedCharacterId && <p className="text-sm text-red-600">{errors.ownedCharacterId[0]}</p>}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!character}
                className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
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
                    directly above its own box(es), but both groups sit side
                    by side in one flex row -- compact (boxSizeClassName, down
                    from the usual 224x224) enough that the boxes themselves
                    still land on one shared line. */}
                <div className="flex flex-wrap gap-4">
                  <div>
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
                      // "" -- the usual 8px gray border reads as too thick at
                      // this compact size.
                      cardBorderClassName=""
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-base font-bold">Artifacts</p>
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

        <Toast message={message} visible={visible} />
      </div>
    </Modal>
  );
}
