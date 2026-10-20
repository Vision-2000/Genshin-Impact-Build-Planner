"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { useToast, Toast } from "@/components/toast";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { createBuild } from "../actions";
import { ArtifactSlotPicker } from "../artifact-slot-picker";
import { CharacterSlotPicker } from "../character-slot-picker";
import { WeaponSlotPicker } from "../weapon-slot-picker";
import type { CreateBuildErrors } from "../schemas";
import type { OwnedArtifactOption, OwnedCharacterOption, OwnedWeaponOption } from "../filter-sort";

const SLOTS = Object.values(ArtifactSlot);

type SlotSelections = Partial<Record<ArtifactSlot, number>>;

type Draft = {
  characterId: number | null;
  name: string;
  weaponId: number | null;
  slots: SlotSelections;
  weaponPickerOpen: boolean;
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
  const [weaponPickerOpen, setWeaponPickerOpen] = useState(false);
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
      setWeaponPickerOpen(draft.weaponPickerOpen);
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
    const draft: Draft = { characterId, name, weaponId, slots, weaponPickerOpen };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [characterId, name, weaponId, slots, weaponPickerOpen]);

  const character = characterId !== null ? characters.find((c) => c.ownedCharacterId === characterId) : undefined;

  function resetForm() {
    setCharacterId(null);
    setName("");
    setWeaponId(null);
    setSlots({});
    setWeaponPickerOpen(false);
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

          {/* w-full (no max-w cap) -- fills the page's own max-w-[110rem]
              container instead of wrapping at a narrower width, so the
              weapon + 5 artifact picker boxes (w-56 each) have more room to
              stay on one line before wrapping forces a scroll. flex-row
              (sm+) puts the character splash (see CharacterSlotPicker) as
              its own full-height left column, same two-column shape the
              character/weapon progression editors use, rather than
              treating it as just one more same-sized slot among the
              others. */}
          <div className="flex w-full flex-col overflow-hidden rounded border sm:flex-row">
            <CharacterSlotPicker characters={characters} value={characterId} onChange={handleCharacterChange} />

            <div className="flex-1 space-y-3 p-4">
              <p className="text-sm font-medium">Weapon</p>
              <div className="flex flex-wrap gap-2">
                <WeaponSlotPicker
                  // null until a character is chosen -- WeaponSlotPicker then
                  // shows every owned weapon regardless of type instead of
                  // narrowing to one (see its own comment), so this field is
                  // usable right away rather than waiting on the character
                  // field above it.
                  weaponType={character?.weaponType ?? null}
                  weapons={weapons}
                  value={weaponId}
                  onChange={setWeaponId}
                  autoOpen={weaponPickerOpen}
                  onOpenChange={setWeaponPickerOpen}
                />
              </div>
              <p className="text-sm font-medium">Artifacts</p>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((slot) => (
                  <ArtifactSlotPicker
                    key={slot}
                    slot={slot}
                    artifacts={artifacts}
                    value={slots[slot] ?? null}
                    onChange={(ownedArtifactId) =>
                      setSlots((prev) => ({ ...prev, [slot]: ownedArtifactId ?? undefined }))
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast message={message} visible={visible} />
    </div>
  );
}
