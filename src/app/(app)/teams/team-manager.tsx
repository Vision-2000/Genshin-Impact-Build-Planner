"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { computeElementalResonances } from "@/lib/elemental-resonance";
import { computeMoonsignHexereiEffects } from "@/lib/moonsign-hexerei";
import { detectOverlaps } from "@/lib/overlap";
import { paginate } from "@/lib/paginate";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import type { TeamEffect } from "@/lib/team-effect";
import { useRefreshOnBackNavigation, wasBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { useDialogs } from "@/components/dialog-provider";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import { BuildPortrait } from "@/components/build-portrait";
import { PlusIcon } from "@/components/plus-icon";
import { BuildDetailModal } from "../builds/build-detail-modal";
import { ELEMENT_ICON_URL } from "../characters/element-icons";
import { PaginationControls, PaginationNavButtons } from "../pagination-controls";
import {
  createTeam,
  updateTeamName,
  deleteTeam,
  addTeamBuild,
  removeTeamBuild,
  replaceTeamBuild,
  reorderTeamBuilds,
  bumpTeamToFront,
  createGroup,
  updateGroup,
  deleteGroup,
  type AddTeamBuildResult,
} from "./actions";
import {
  MAX_TEAM_SIZE,
  filterTeams,
  toOverlapCheckBuild,
  memberBuildsForTeam,
  computeTeamConflicts,
  buildConflictFlags,
  describeTeamConflict,
  combinedOverlapBuilds,
  describeGroupConflict,
  prioritizeGroupConflicts,
  type BuildOption,
  type TeamItem,
  type GroupItem,
} from "./filter-sort";
import { BuildSlotPicker } from "./build-slot-picker";

const PAGE_SIZE = 10;
// A 3-wide/2-tall rectangle, not a square -- matches BuildPortrait's own
// aspect ratio (see build-slot-picker.tsx's own comment on why a filled
// slot uses BuildPortrait instead of a square CharacterCard at all: a
// small circular weapon/set-effect badge turned out to be too small to
// actually read). w-[26rem] at aspect-[3/2] works out to a 416x277 box --
// each of BuildPortrait's own weapon/artifact-effects icons is a third of
// that width (~139px). The card grid is a single column (see the "always
// 1 column" comment below), so there's no column width to stay under.
const SLOT_SIZE_CLASS = "aspect-[3/2] w-[26rem]";
// A team is a perfectly valid, real in-game state with 0 builds in it (a
// party slot can sit empty) -- "Create team" no longer prompts for a name
// up front, it just makes one of these immediately and lets
// TeamNameInput's own inline rename handle the rest, the same way a build
// slot starts empty and gets filled in afterward rather than demanding
// everything up front.
const DEFAULT_TEAM_NAME = "New Team";

// Which of TeamManager's own two modals (BuildDetailModal's "view", or one
// slot's own BuildSlotPicker "select") was open right before a navigation
// away from this page -- e.g. following BuildDetailModal's own "Edit
// build" button, or BuildSlotPicker's own "Need another build? Create one
// on the Builds page" link. Both unmount TeamManager entirely (a real
// route change, not a modal-over-modal), so neither `viewing` nor
// `reopenPicker` survives on their own; this sessionStorage draft is what
// lets the right modal reopen on the way back, the same round-trip-
// survival technique BuildCatalog's own create-build draft already uses
// (see its own DRAFT_KEY comment) -- applied here to "which modal/slot was
// open" instead of a form's field values. slotIndex (not buildId) is the
// key for "selecting", since an EMPTY slot's own BuildSlotPicker can be
// reopened too, and every empty slot shares the same buildId (null).
type TeamsPageDraft =
  | { kind: "viewing"; teamId: number; slotIndex: number; buildId: number }
  | { kind: "selecting"; teamId: number; slotIndex: number };

const DRAFT_KEY = "teams-page-draft";

function readDraft(): TeamsPageDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as TeamsPageDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: TeamsPageDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore -- sessionStorage can throw in a private/locked-down browser
    // context; losing the "reopen on Back" convenience isn't worth
    // crashing the page over.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Same as writeDraft above.
  }
}

// Applies `updater` to the one team matching `teamId`, in place -- unlike
// the earlier touchTeam this replaced, ordinary edits (rename, add/remove
// build) never move a team's position in the list any more; only
// handleBumpToFront does that, explicitly. A no-op (returns `teams`
// unchanged) if teamId isn't found, which shouldn't happen in practice but
// is cheap to guard against.
function updateTeamInPlace(teams: TeamItem[], teamId: number, updater: (team: TeamItem) => TeamItem): TeamItem[] {
  return teams.map((team) => (team.id === teamId ? updater(team) : team));
}

function TeamNameInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  return (
    <input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
        else setDraft(value);
      }}
      // stopPropagation -- TeamCard's own root <li> now toggles group
      // selection on click (see its own comment), so a click that's
      // really just focusing this input to rename the team has to be
      // stopped here, or it'd also toggle the card out from under the
      // user while they're mid-click on an unrelated field.
      onClick={(event) => event.stopPropagation()}
      // max-w-xs (not flex-1 alone) -- flex-1 used to be harmless when the
      // team card itself was narrow (a multi-column grid), but now that
      // the card spans the full page width (see the "always 1 column"
      // comment below) it stretched this into an absurdly wide text box.
      className="min-w-0 max-w-xs flex-1 rounded border bg-white px-2 py-1 text-sm font-medium text-black"
    />
  );
}

// Shared hover-tooltip shell for both the Elemental Resonance pill and the
// Moonsign/Hexerei icons below -- same "icon-only face, full effect text
// one hover away" pattern BuildStatsSummary's own Artifact Set Effects box
// already uses, just over a small icon instead of a titled box now that
// these moved into the header's own leftover space (see TeamCard's own
// comment on why). At most 2-3 entries can ever be active at once on a
// 4-build team (see computeElementalResonances'/
// computeMoonsignHexereiEffects' own comments), so this never needs to
// handle a long list.
function TeamEffectTooltip({ effects, children }: { effects: TeamEffect[]; children: ReactNode }) {
  return (
    <MouseFollowTooltip
      wrapperClassName="relative block"
      content={
        <div className="space-y-3">
          {effects.map((effect, index) => (
            <div key={effect.name}>
              {index > 0 && <hr className="mb-3 border-gray-700" />}
              <p className="text-base font-semibold text-yellow-100">{effect.name}</p>
              {/* whitespace-pre-line -- Moonsign's own Ascendant Gleam
                  text has real line breaks of its own (see
                  moonsign-hexerei.ts), which a plain <p> would otherwise
                  collapse into one run-on line. */}
              <p className="mt-1 whitespace-pre-line text-gray-300">{effect.effect}</p>
            </div>
          ))}
        </div>
      }
    >
      {children}
    </MouseFollowTooltip>
  );
}

// A team's own 4 build slots, each a BuildSlotPicker -- array position IS
// slot identity here (members[0] is slot 0, etc.), which has no deeper
// meaning than "whatever order the server returned them in", same as any
// other unordered-by-design list in this app. A slot past team.members
// .length is simply empty (buildId null). This replaces the earlier
// "members list + a <select> to add one" layout -- matches the slot-
// picker pattern Builds already established for weapon/artifact, rather
// than a one-off control just for this page.
function TeamCard({
  team,
  builds,
  onUpdateName,
  onSlotChange,
  onReorder,
  onView,
  // Non-null only on the one team/slot BuildDetailModal's own "Select
  // another build" button just targeted, or a slot restored from a
  // sessionStorage draft after a Builds-page round trip (team-manager.tsx's
  // own reopenPicker state, see its own comment) -- null for every other
  // TeamCard, and usually null here too. Reopens that slot's
  // BuildSlotPicker exactly as if the user had clicked the upper part of
  // its own card. Keyed by slot INDEX, not buildId -- buildId is null for
  // an empty slot, which an index still identifies uniquely but a shared
  // null wouldn't. onReopenConsumed fires once that slot's picker actually
  // closes (select OR cancel), clearing the parent's one-shot state so a
  // later unrelated open/close elsewhere on the page doesn't re-trigger
  // anything.
  reopenSlotIndex,
  onReopenConsumed,
  // Fires for ANY slot's own BuildSlotPicker opening or closing (not just
  // a reopen-triggered one) -- team-manager.tsx uses this to keep its own
  // sessionStorage "which modal was open" draft in sync, the same
  // round-trip-survival technique BuildCatalog's own draft already uses,
  // applied here to "which team slot's picker is open" instead of a
  // create-build form's field values.
  onPickerOpenChange,
  onBumpToFront,
  onDelete,
  // Non-null only while the page is in "group mode" (team-manager.tsx's
  // own groupDraft state) -- renders a full-card overlay that intercepts
  // every click/drag on this card (rename, slot swap, drag-reorder,
  // bump-to-front, delete, all of it) in favor of a single toggle, plus a
  // checkmark badge reflecting `selected`. Undefined in ordinary use,
  // which renders nothing extra here at all.
  groupSelection,
}: {
  team: TeamItem;
  builds: BuildOption[];
  onUpdateName: (name: string) => void;
  onSlotChange: (oldBuildId: number | null, newBuildId: number | null) => void;
  // Slot INDEX, not buildId -- unlike onSlotChange (which only ever
  // targets one slot by what it currently holds), a reorder needs both
  // endpoints at once, and the dragged slot's own buildId is still
  // reachable via slotBuildIds[fromIndex] if a future caller needs it.
  onReorder: (fromIndex: number, toIndex: number) => void;
  // Opens TeamManager's own single, shared BuildDetailModal -- not a
  // modal owned by this card or by BuildSlotPicker itself, since only one
  // of these should ever be open across the whole page at once.
  // weaponConflict/conflictingArtifactIds are THIS team's own
  // computeTeamConflicts result for the build being viewed (see this
  // card's own conflicts below) -- computed here, not re-derived at
  // TeamManager, since a build can be reused across multiple teams
  // simultaneously and "which team" would otherwise be ambiguous there.
  // slotIndex travels alongside buildId purely so TeamManager can restore
  // (or reopen) the right slot's own picker later -- BuildDetailModal
  // itself has no use for it.
  onView: (slotIndex: number, buildId: number, weaponConflict: boolean, conflictingArtifactIds: number[]) => void;
  reopenSlotIndex: number | null;
  onReopenConsumed: () => void;
  onPickerOpenChange: (slotIndex: number, open: boolean) => void;
  onBumpToFront: () => void;
  onDelete: () => void;
  groupSelection?: { selected: boolean; onToggle: () => void };
}) {
  const slotBuildIds: (number | null)[] = [
    ...team.members.map((m) => m.buildId),
    ...Array(Math.max(0, MAX_TEAM_SIZE - team.members.length)).fill(null),
  ].slice(0, MAX_TEAM_SIZE);

  // Custom pointer-based drag, not native HTML5 drag-and-drop -- native
  // drag always renders its own "ghost" preview through the browser/OS's
  // own compositor at a fixed, reduced opacity no CSS can override
  // (dataTransfer.setDragImage only picks WHICH element to snapshot, not
  // how it's rendered). A real, fully-opaque floating copy needs an
  // actual DOM element tracking the cursor instead -- see the
  // BuildPortrait rendered at the bottom of this component. Pointer
  // Events (not mouse/touch events separately) also means this works on
  // touch devices for free, which native HTML5 drag never did either.
  //
  // A 4-item reorder within one team doesn't need dnd-kit's own
  // touch/accessibility machinery to be worth the dependency here (unlike
  // the earlier, since-abandoned idea of reordering whole TEAMS on this
  // page, where pagination/search made drag targets genuinely ambiguous
  // -- none of that applies within one team's own fixed 4 slots). Only a
  // FILLED slot is draggable or a valid drop target; dragging onto an
  // empty slot isn't supported -- there's no persisted "this slot is
  // empty" identity to move INTO (a real slot column would be needed for
  // that, not built here), so reordering is scoped to permuting the slots
  // that already hold something.
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  // The slot currently under the cursor during a drag, for the "this is
  // where it'll land" ring -- separate from draggedIndex, the dimmed
  // source.
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);

  // Mirror the latest props/derived values into refs after every render
  // (an effect with no dependency array, not a plain render-time
  // assignment -- React's own rule against mutating refs during render)
  // so the window-level listeners below -- attached ONCE on mount, not
  // re-subscribed on every pointer-move frame -- always read through-the-
  // ref current data instead of closing over whatever was current the one
  // time the effect first ran.
  const slotBuildIdsRef = useRef(slotBuildIds);
  const onReorderRef = useRef(onReorder);
  useEffect(() => {
    slotBuildIdsRef.current = slotBuildIds;
    onReorderRef.current = onReorder;
  });

  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const dragSizeRef = useRef<{ width: number; height: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    // Below this many pixels of movement, a pointerdown+pointerup is
    // treated as a plain click (never preventDefault'd, so BuildSlotPicker's
    // own onClick still opens its swap modal normally) rather than a drag.
    const DRAG_THRESHOLD = 5;

    function slotIndexAt(x: number, y: number): number | null {
      const el = document.elementFromPoint(x, y);
      const slotEl = el instanceof Element ? el.closest<HTMLElement>("[data-team-slot-index]") : null;
      if (!slotEl) return null;
      const index = Number(slotEl.dataset.teamSlotIndex);
      return slotBuildIdsRef.current[index] !== null ? index : null;
    }

    function handlePointerMove(event: PointerEvent) {
      const start = dragStartRef.current;
      if (!start) return;

      if (draggedIndexRef.current === null) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        const rect = slotRefs.current[start.index]?.getBoundingClientRect();
        if (rect) {
          dragSizeRef.current = { width: rect.width, height: rect.height };
          setDragSize(dragSizeRef.current);
        }
        draggedIndexRef.current = start.index;
        setDraggedIndex(start.index);
      }

      // Imperative, not React state -- moving the overlay through
      // setState on every pixel of pointer movement would re-render this
      // whole card dozens of times a second; writing straight to the
      // already-mounted overlay node's own style keeps the drag smooth.
      // Centered under the cursor (offset by half its own size).
      if (overlayRef.current && dragSizeRef.current) {
        const { width, height } = dragSizeRef.current;
        overlayRef.current.style.transform = `translate(${event.clientX - width / 2}px, ${event.clientY - height / 2}px)`;
      }

      // Excludes the dragged slot's own index -- right at the start of a
      // drag the cursor is still essentially over the source, so without
      // this, dragOverIndex briefly equals draggedIndex and both
      // opacity-0 and opacity-50 land on the same element (opacity-50
      // wins in Tailwind's generated CSS), leaving the source dimmed
      // instead of fully invisible until the cursor moved elsewhere.
      const hit = slotIndexAt(event.clientX, event.clientY);
      setDragOverIndex(hit !== null && hit !== draggedIndexRef.current ? hit : null);
    }

    function handlePointerUp(event: PointerEvent) {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start || draggedIndexRef.current === null) return;

      // A genuine drag happened -- the browser still fires an ordinary
      // click on whatever's under the pointer right after pointerup
      // regardless of how far it traveled in between, which would
      // otherwise immediately reopen the dropped-on slot's own picker
      // modal. Swallowed once, in the capture phase, by the click
      // listener below.
      suppressNextClickRef.current = true;

      const hitIndex = slotIndexAt(event.clientX, event.clientY);
      if (hitIndex !== null && hitIndex !== start.index) onReorderRef.current(start.index, hitIndex);

      draggedIndexRef.current = null;
      dragSizeRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragSize(null);
    }

    function handleClickCapture(event: MouseEvent) {
      if (!suppressNextClickRef.current) return;
      suppressNextClickRef.current = false;
      event.stopPropagation();
      event.preventDefault();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    // capture: true -- must run before BuildSlotPicker's own onClick does.
    window.addEventListener("click", handleClickCapture, true);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  // Elemental Resonance and Team Effects (Moonsign/Hexerei) both only
  // care about which builds are actually in the team right now, not
  // which slot they're in -- built straight from team.members (not
  // slotBuildIds, which pads with nulls purely for rendering 4 slot
  // positions).
  const memberBuilds = memberBuildsForTeam(team, builds);
  const resonances = computeElementalResonances(memberBuilds.map((build) => build.element));
  const moonsignCount = memberBuilds.filter((build) => build.isMoonsignCharacter).length;
  const hexereiCount = memberBuilds.filter((build) => build.isHexereiCharacter).length;
  // Kept as effect TEXT lookups for the hover tooltips below, not as the
  // on/off signal itself -- moonsignCount/hexereiCount directly drive
  // which icon shows and at which color (see the header row below), since
  // "Nascent Gleam present" alone can't tell muted (count 1) from full
  // (count 2+) the way the raw count can.
  const teamEffects = computeMoonsignHexereiEffects({ moonsignCount, hexereiCount });
  const moonsignEffects = teamEffects.filter((effect) => effect.name === "Nascent Gleam" || effect.name === "Ascendant Gleam");
  const hexereiEffects = teamEffects.filter((effect) => effect.name === "Hexerei: Secret Rite");

  // Weapon/artifact pieces this team's own builds have drifted into
  // sharing since they were added -- the add/swap-time overlap check
  // (BuildSlotPicker's own candidate filter) already prevents creating
  // this, but can't catch a build's weapon/artifacts being changed LATER
  // from the Builds page, after it's already sitting here (see
  // computeTeamConflicts' own comment). Surfaced via the red ring on each
  // affected slot's own BuildPortrait tile below, the whole card's own
  // red border, and the warning text under the build slots.
  const conflicts = computeTeamConflicts(memberBuilds);

  // The build currently being drag-previewed -- undefined whenever
  // draggedIndex is null, which the overlay render below already guards.
  const draggedBuild = draggedIndex !== null ? builds.find((b) => b.buildId === slotBuildIds[draggedIndex]) : undefined;

  return (
    // Border color: red (conflicts.length > 0) wins over blue
    // (groupSelection?.selected) -- a drifted-into-conflict team is the
    // more urgent signal of the two -- which in turn wins over the plain
    // default border. Same border-only "selected" convention WeaponCard/
    // CharacterCard/the build picker's own cards already use (a color
    // swap on the SAME border width).
    //
    // onClick toggles group selection directly on the card -- no full-
    // card OVERLAY any more (that used to sit on TOP and block every one
    // of this card's own interactive elements), and no longer limited to
    // the small checkbox either (clicking it alone felt like an extra,
    // unwanted step on top of what should just be "click the card").
    // Instead, every genuinely interactive descendant (the checkbox
    // itself, the rename input, each of the 4 BuildSlotPickers, Move to
    // top, Delete) stops this click from bubbling any further in ITS OWN
    // handler, so clicking one of those always takes priority and does
    // its own thing; a click anywhere else on the card (empty space,
    // labels, the resonance/Moonsign/Hexerei tooltip icons, which have no
    // click behavior of their own to begin with) falls through to this
    // handler and toggles selection instead. Undefined (not a no-op
    // function) when groupSelection itself is undefined, so clicking the
    // card outside group mode does nothing, same as always.
    <li
      onClick={groupSelection?.onToggle}
      className={`space-y-3 rounded-xl border p-4 ${groupSelection ? "cursor-pointer" : ""} ${
        conflicts.length > 0 ? "border-red-500" : groupSelection?.selected ? "border-blue-500" : ""
      }`}
    >
      {/* min-h-10 -- matches the Moonsign/Hexerei badges' own fixed h-10,
          the tallest thing this row can ever contain. Without it, a team
          with no active resonance/Moonsign/Hexerei rendered a shorter row
          (just the name field/buttons) than one that did, so the space
          above the build slots grew or shrank per team instead of staying
          consistent -- same fix as the top pagination rows' own min-h-8. */}
      <div className="flex min-h-10 items-center justify-between gap-2">
        {/* Grouped with the name field (not a 3rd justify-between sibling
            of its own) so the icons sit right next to it instead of
            floating centered in whatever space is left over -- that
            leftover space goes between this whole group and the Delete
            button instead. Each icon is hidden outright (not an empty
            placeholder) when it isn't active, since most teams won't have
            every one of these at once. */}
        <div className="flex min-w-0 items-center gap-2">
          {/* A visible, explicit indicator of group-selection state (and a
              keyboard/screen-reader-reachable way to toggle it) alongside
              the card's own click-anywhere-to-toggle behavior (see this
              component's own return comment) -- not the only way to
              toggle any more, but still worth keeping for that reason.
              stopPropagation -- otherwise a click here would ALSO bubble
              up to the card's own onClick and toggle a second time,
              canceling this one out. */}
          {groupSelection && (
            <input
              type="checkbox"
              checked={groupSelection.selected}
              onChange={groupSelection.onToggle}
              onClick={(event) => event.stopPropagation()}
              title="Include this team in the group"
              className="h-5 w-5 shrink-0 accent-blue-500"
            />
          )}
          <TeamNameInput value={team.name} onCommit={onUpdateName} />

          {/* One black pill PER active resonance (not one shared pill for
              all of them) -- each same-element pill shows that element's
              own icon twice, since the resonance is what having 2 of that
              element in the party actually means. Up to 2 can be active
              on a 4-build team (computeElementalResonances' own comment),
              so this is at most 2 side-by-side pills, never a long row.
              Protective Canopy is the one resonance with no single
              `element` of its own (it needs all 4 slots filled with 4
              DIFFERENT elements, see elemental-resonance.ts's own
              comment) -- rendered as a 2x2 mosaic instead, each quadrant
              showing that SAME quadrant of one team member's own element
              icon (top-left of member 1, top-right of member 2, and so
              on), reusing memberBuilds directly rather than trying to
              force 4 elements through TeamEffect's own single-`element`
              shape. */}
          {resonances.map((effect) =>
            effect.name === "Protective Canopy" ? (
              <TeamEffectTooltip key={effect.name} effects={[effect]}>
                <div className="relative h-9 w-9 overflow-hidden rounded-full bg-black p-1">
                  {/* The padding above sits on the OUTER circle, not on
                      each Image directly -- `fill` positions each one
                      against its nearest positioned ancestor, so this
                      inner div (sized to the padded remainder) is what
                      actually keeps the mosaic from touching the circle's
                      own edge. */}
                  <div className="relative h-full w-full">
                    {memberBuilds.map((build, index) => (
                      <Image
                        key={index}
                        src={ELEMENT_ICON_URL[build.element]}
                        alt={build.element}
                        fill
                        className="object-contain"
                        style={{
                          clipPath: [
                            "inset(0 50% 50% 0)", // top-left
                            "inset(0 0 50% 50%)", // top-right
                            "inset(50% 50% 0 0)", // bottom-left
                            "inset(50% 0 0 50%)", // bottom-right
                          ][index],
                        }}
                      />
                    ))}
                  </div>
                </div>
              </TeamEffectTooltip>
            ) : (
              <TeamEffectTooltip key={effect.name} effects={[effect]}>
                <div className="flex h-9 items-center gap-1 rounded-full bg-black px-2">
                  {effect.element && (
                    <>
                      <Image src={ELEMENT_ICON_URL[effect.element]} alt={effect.name} width={20} height={20} />
                      <Image src={ELEMENT_ICON_URL[effect.element]} alt={effect.name} width={20} height={20} />
                    </>
                  )}
                </div>
              </TeamEffectTooltip>
            )
          )}

          {moonsignCount >= 1 && (
            <TeamEffectTooltip effects={moonsignEffects}>
              {/* Nascent Gleam (moonsignCount 1) renders washed-out/pale
                  (desaturated + brightened) -- Moonsign.webp is a full
                  illustrated emblem with no alpha channel, not a flat
                  icon on a transparent background, so a solid white
                  silhouette (e.g. brightness-0 invert) isn't achievable
                  with CSS filters alone on it -- that combination
                  collapses the whole opaque square to one flat color
                  instead of preserving the art's own shape. Turns the
                  image's own full blue color once Ascendant Gleam also
                  kicks in (moonsignCount 2+), the same "every threshold
                  reached, not just the highest" relationship moonsign-
                  hexerei.ts's own comment describes for the text version
                  of these two effects. */}
              {/* h-9 w-9, smaller than Hexerei's own h-10 w-10 -- the
                  scale-[1.75] zoom (kept as-is, not the issue) made this
                  badge read as bigger than Hexerei even at the same
                  container size. */}
              <div className="relative h-9 w-9 overflow-hidden rounded-full">
                {/* scale-[1.75] -- the source image's own actual symbol
                    only fills the center portion of its square canvas,
                    with extra material around it; object-cover alone
                    still showed that surrounding material instead of
                    cropping it away, so this zooms in past 100% to push
                    it outside the circle's own overflow-hidden bounds.
                    An arbitrary value, not scale-150's own fixed step --
                    Tailwind has no built-in 175% stop. */}
                <Image
                  src="/icons/Moonsign.webp"
                  alt="Moonsign"
                  fill
                  className={`scale-[1.75] object-cover ${moonsignCount >= 2 ? "" : "grayscale brightness-150"}`}
                />
              </div>
            </TeamEffectTooltip>
          )}

          {hexereiCount >= 2 && (
            <TeamEffectTooltip effects={hexereiEffects}>
              {/* No muted tier here -- unlike Moonsign, Hexerei has only
                  the one threshold (moonsign-hexerei.ts's own comment:
                  "Hexerei only has the one 2+ threshold, no Hexerei
                  equivalent of Nascent Gleam at count 1"), so there's
                  nothing partial to show muted for. */}
              <div className="relative h-10 w-10 overflow-hidden rounded-full">
                <Image src="/icons/Hexerei.webp" alt="Hexerei" fill className="object-cover" />
              </div>
            </TeamEffectTooltip>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Moves this team to the top of the full list (see
              handleBumpToFront's own comment) -- the only user-facing way
              a team's position ever changes now that ordinary edits don't
              move it any more. Same solid-black/white-border button this
              app already uses for every other non-destructive primary
              action (Save, Add, etc. -- see e.g. owned-build-manager.tsx's
              own Save button), not a one-off style -- a plain border alone
              (this app's OTHER kind of secondary button, e.g. "+ New
              Team") read as inert/non-clickable text next to the solid
              red Delete button beside it. */}
          <button
            type="button"
            onClick={(event) => {
              // stopPropagation -- see the card's own root <li> onClick
              // comment on why every genuinely interactive element here
              // needs this now.
              event.stopPropagation();
              onBumpToFront();
            }}
            title="Move to top"
            className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            Move to top
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {slotBuildIds.map((buildId, index) => {
          // Every OTHER filled slot's own build, excluding this slot's own
          // current pick -- fed to this slot's own BuildSlotPicker so it
          // can filter out any candidate that would conflict (duplicate
          // character, shared exclusivityGroup, shared weapon, shared
          // artifact) with the rest of the team. A build appearing twice
          // in slotBuildIds can't happen in practice (detectOverlaps
          // already blocks reusing the same character, which the same
          // build always has), so no separate dedup is needed here.
          const otherBuilds = slotBuildIds
            .filter((id, otherIndex) => otherIndex !== index && id !== null)
            .map((id) => builds.find((b) => b.buildId === id))
            .filter((b): b is BuildOption => b !== undefined)
            .map(toOverlapCheckBuild);

          const isFilled = buildId !== null;
          const slotConflictFlags = buildId !== null ? buildConflictFlags(buildId, conflicts) : null;
          // Only ever true for exactly one slot across the whole page at
          // a time -- see this prop's own comment above for where it
          // comes from.
          const isReopenTarget = index === reopenSlotIndex;

          return (
            <div
              key={index}
              ref={(el) => {
                slotRefs.current[index] = el;
              }}
              data-team-slot-index={index}
              // stopPropagation -- the card's own root <li> now toggles
              // group selection on click (see its own comment); this slot
              // (its own click-to-swap box, AND everything inside
              // BuildSlotPicker's own Modal -- a DOM descendant of this
              // div regardless of its fixed on-screen position) needs to
              // take priority over that for every click anywhere within
              // it, not just the slot box itself.
              onClick={(event) => event.stopPropagation()}
              onPointerDown={
                isFilled
                  ? (event) => {
                      if (event.button !== 0) return; // primary button/touch only
                      dragStartRef.current = { index, x: event.clientX, y: event.clientY };
                    }
                  : undefined
              }
              // Suppresses the browser's own native image-drag (BuildPortrait
              // renders <img>s, which are draggable by default) so it never
              // fights with the pointer-based drag above.
              onDragStart={(event) => event.preventDefault()}
              className={[
                isFilled && "touch-none select-none",
                // The dragged source is invisible, not dimmed -- the
                // floating BuildPortrait overlay is already standing in
                // for it, so showing both at once just looked like two
                // copies. The hover TARGET gets the opacity-50 dimming
                // instead, showing which card the drop would replace.
                draggedIndex === index && "opacity-0",
                dragOverIndex === index && "opacity-50",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <BuildSlotPicker
                builds={builds}
                otherOverlapBuilds={otherBuilds}
                value={buildId}
                onChange={(newBuildId) => onSlotChange(buildId, newBuildId)}
                onView={(viewedBuildId) => {
                  const flags = buildConflictFlags(viewedBuildId, conflicts);
                  onView(index, viewedBuildId, flags.weaponConflict, flags.conflictingArtifactIds);
                }}
                weaponConflict={slotConflictFlags?.weaponConflict}
                artifactConflict={(slotConflictFlags?.conflictingArtifactIds.length ?? 0) > 0}
                autoOpen={isReopenTarget}
                onOpenChange={(open) => {
                  onPickerOpenChange(index, open);
                  if (isReopenTarget && !open) onReopenConsumed();
                }}
                boxSizeClassName={SLOT_SIZE_CLASS}
              />
            </div>
          );
        })}
      </div>

      {/* One line per conflict -- see computeTeamConflicts' own comment
          on why this can happen at all despite the add/swap-time check. */}
      {conflicts.length > 0 && (
        <ul className="space-y-1 text-sm text-red-500">
          {conflicts.map((conflict, index) => (
            <li key={index}>
              {describeTeamConflict(conflict, memberBuilds).map((part, partIndex) =>
                part.type === "build" ? (
                  // Build name italicized, in parens -- distinguishes it
                  // from the character name right next to it, since both
                  // are plain names otherwise.
                  <span key={partIndex}>
                    {part.characterName} (<em>{part.buildName}</em>)
                  </span>
                ) : (
                  <span key={partIndex}>{part.text}</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {/* The real floating drag preview -- a genuine BuildPortrait render
          (not a browser-native drag ghost, see this component's own top
          comment), positioned via a ref-mutated transform rather than
          React state so dragging stays smooth. position: fixed, sized to
          match the slot it was picked up from (dragSize, captured once at
          drag start) -- its initial off-screen transform here is only
          ever visible for the single frame before the first pointermove
          repositions it under the cursor.
          Portaled straight to document.body rather than rendered inline
          here -- even though position: fixed removes it from this card's
          own layout, something about it being a DOM descendant of this
          <li> was still growing the card's own bottom space while a drag
          was active. A portal sidesteps that category of bug entirely by
          construction, rather than chasing the exact CSS mechanism behind
          it, which is also just the more correct way to build a "follows
          the cursor, renders above everything" overlay in React to begin
          with. */}
      {draggedIndex !== null &&
        dragSize &&
        draggedBuild &&
        createPortal(
          <div
            ref={overlayRef}
            className={`pointer-events-none fixed left-0 top-0 z-50 flex overflow-hidden rounded-lg border border-white shadow-xl ${rarityGradientClasses(
              draggedBuild.rarity
            )}`}
            style={{ width: dragSize.width, height: dragSize.height, transform: "translate(-9999px, -9999px)" }}
          >
            <BuildPortrait
              characterIconUrl={draggedBuild.characterIconUrl}
              characterElement={draggedBuild.element}
              buildName={draggedBuild.name}
              characterName={draggedBuild.characterName}
              weaponIconUrl={draggedBuild.weaponIconUrl}
              weaponRarity={draggedBuild.weaponRarity}
              characterWeaponType={draggedBuild.weaponType}
              activeSetEffects={draggedBuild.activeSetEffects}
            />
          </div>,
          document.body
        )}
    </li>
  );
}

export function TeamManager({
  header,
  builds,
  initialTeams,
  initialGroups,
}: {
  // The page's own title block -- same reasoning as OwnedBuildManager's
  // own header prop (see page.tsx's own comment): "Create team" drives
  // client state (even though it no longer opens a modal, see
  // DEFAULT_TEAM_NAME's own comment), so the row holding both lives here.
  header: ReactNode;
  builds: BuildOption[];
  initialTeams: TeamItem[];
  initialGroups: GroupItem[];
}) {
  // Following "Edit build" (build-detail-modal.tsx) to the Builds page and
  // back via the browser Back button -- or any other same-document
  // navigation away and back -- can restore this page from Next's client
  // router cache without re-running the server component, leaving `teams`
  // on its pre-navigation snapshot even though the edit landed correctly.
  // useRefreshOnBackNavigation forces a server refetch on popstate; the
  // prevInitialTeams comparison below is what actually applies the fresh
  // props once they arrive -- same two-part fix OwnedBuildManager's own
  // identical bug already needed (see its own comment for why this has to
  // happen during render, not in an effect).
  useRefreshOnBackNavigation();
  const [teams, setTeams] = useState(initialTeams);
  const [prevInitialTeams, setPrevInitialTeams] = useState(initialTeams);
  if (initialTeams !== prevInitialTeams) {
    setPrevInitialTeams(initialTeams);
    setTeams(initialTeams);
  }
  // Same staleness fix, same reason, for the saved groups list.
  const [groups, setGroups] = useState(initialGroups);
  const [prevInitialGroups, setPrevInitialGroups] = useState(initialGroups);
  if (initialGroups !== prevInitialGroups) {
    setPrevInitialGroups(initialGroups);
    setGroups(initialGroups);
  }
  const [, startTransition] = useTransition();
  const { confirm, notify } = useDialogs();

  // null outside "group mode"; set by "Create group"/"Edit group" below.
  // groupId is null while CREATING (nothing to update yet) and the saved
  // group's own id while editing. teamIds is the in-progress draft
  // selection, in the order teams were added to it -- appended to on
  // select, spliced out on deselect -- which is what the saved group's
  // own "order selected" display (GroupTeam's own schema comment) reflects
  // once this is saved.
  const [groupDraft, setGroupDraft] = useState<{ groupId: number | null; name: string; teamIds: number[] } | null>(
    null
  );
  // A server-side error from the last save attempt (e.g. a team deleted by
  // another tab between this draft's own live client-side check and the
  // actual save) -- distinct from the live validation below, which is
  // purely derived from current teams/builds and never itself an
  // error object.
  const [groupSaveError, setGroupSaveError] = useState<string | null>(null);
  const inGroupMode = groupDraft !== null;

  // Live, non-blocking validation of the in-progress draft -- same
  // generic detectOverlaps this app's own Key decisions mandate reusing
  // everywhere, via combinedOverlapBuilds (filter-sort.ts). Unlike a
  // single team's own build-picker (which hard-blocks a conflicting
  // candidate from ever being selectable), picking a conflicting TEAM
  // into a group draft is allowed -- only saving is gated on this being
  // empty -- since seeing the full intended set before deciding what to
  // swap out is more useful here than blocking the pick outright.
  const groupDraftConflicts = groupDraft ? detectOverlaps(combinedOverlapBuilds(teams, builds, groupDraft.teamIds)) : [];

  // Which dropdown entry is selected -- null is "All teams" (the default,
  // shows every team, unfiltered). Reset to null whenever the selected
  // group no longer exists (e.g. it was deleted in another tab) so the
  // dropdown doesn't silently point at nothing.
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  // Plain render-time state adjustment (same shape as the
  // prevInitialTeams/prevInitialGroups comparisons above), not an effect
  // -- safe from infinite recursion since the condition itself becomes
  // false the instant this runs (selectedGroupId !== null fails on the
  // next render).
  if (selectedGroupId !== null && !groups.some((g) => g.id === selectedGroupId)) {
    setSelectedGroupId(null);
  }

  // Whether each saved group's OWN current members have drifted into
  // conflict since it was last saved (a team's builds can change after
  // the fact, same reasoning computeTeamConflicts already has for a
  // single team) -- computed for every group up front, not just whichever
  // one is selected, so the dropdown itself can flag a drifted group
  // before the user even opens it.
  const groupConflictById = new Map(
    groups.map((group) => [group.id, detectOverlaps(combinedOverlapBuilds(teams, builds, group.teamIds)).length > 0])
  );

  // One shared BuildDetailModal for the whole page, not one per TeamCard --
  // at most one can ever be open at a time regardless of which slot
  // triggered it. weaponConflict/conflictingArtifactIds travel alongside
  // buildId rather than being recomputed here -- see TeamCard's own onView
  // prop comment on why "which team" would otherwise be ambiguous. teamId/
  // slotIndex travel too, purely so "Select another build" (below) and the
  // sessionStorage draft (see TeamsPageDraft's own comment) know which
  // team/slot to reopen -- the modal itself has no other use for either.
  const [viewing, setViewing] = useState<{
    teamId: number;
    slotIndex: number;
    buildId: number;
    weaponConflict: boolean;
    conflictingArtifactIds: number[];
  } | null>(null);

  // Set by BuildDetailModal's own "Select another build" button, or by the
  // mount-time draft restore below -- reopens the target team slot's own
  // BuildSlotPicker, as if the user had clicked the upper part of its own
  // card instead of the View button (or had never left the page at all).
  // Only ever names one (teamId, slotIndex) pair at a time; TeamCard clears
  // it back to null itself once that slot's picker closes (see its own
  // reopenSlotIndex/onReopenConsumed props).
  const [reopenPicker, setReopenPicker] = useState<{ teamId: number; slotIndex: number } | null>(null);

  // Runs once, right after the initial render: restore whichever modal a
  // sessionStorage draft says was open right before this page was last
  // navigated away from (see TeamsPageDraft's own comment on when that
  // happens). Gated on wasBackNavigation() -- the draft is only meant to
  // survive the SPECIFIC round trip of following a link away (Edit build,
  // or the picker's own "create one on the Builds page" link) and pressing
  // Back, not an ordinary nav-bar click back to this page, which should
  // always land on a clean, modal-free Teams page even if a draft happens
  // to still be sitting in sessionStorage from an earlier, unrelated visit.
  // A leftover draft is discarded outright (not left to possibly resurface
  // later) whenever this mount turns out not to be a Back-navigation one.
  //
  // A deliberate react-hooks/set-state-in-effect exception, same as
  // BuildCatalog's own identical mount-restore effect -- this is
  // "synchronize with an external store" on mount, not derived-state
  // busywork. Re-derives weaponConflict/conflictingArtifactIds from the
  // CURRENT teams/builds rather than trusting anything stale the draft
  // might have carried -- it stores neither, only the ids needed to look
  // them back up.
  //
  // hasCheckedBackNavRef guards wasBackNavigation()'s own consume-and-clear
  // read specifically against React Strict Mode's dev-only double-invoke
  // of a fresh mount's effects (mount -> cleanup -> mount again, same
  // component instance/state throughout, unlike a genuine unmount) --
  // without it, the SECOND invocation would find the flag already
  // consumed by the first and wrongly conclude this wasn't a Back
  // navigation after all. BuildCatalog's own equivalent restore effect
  // doesn't need this: reading sessionStorage and reapplying the same
  // state twice is harmless, but wasBackNavigation() is a genuine
  // one-shot read specifically BECAUSE it has to tell a real Back/Forward
  // apart from an ordinary later mount that didn't involve one at all.
  const hasCheckedBackNavRef = useRef(false);
  useEffect(() => {
    if (hasCheckedBackNavRef.current) return;
    hasCheckedBackNavRef.current = true;
    if (!wasBackNavigation()) {
      clearDraft();
      return;
    }
    const draft = readDraft();
    if (!draft) return;
    const team = teams.find((t) => t.id === draft.teamId);
    if (!team) {
      clearDraft();
      return;
    }
    if (draft.kind === "viewing") {
      const build = builds.find((b) => b.buildId === draft.buildId);
      if (!build) {
        clearDraft();
        return;
      }
      const flags = buildConflictFlags(draft.buildId, computeTeamConflicts(memberBuildsForTeam(team, builds)));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewing({
        teamId: draft.teamId,
        slotIndex: draft.slotIndex,
        buildId: draft.buildId,
        weaponConflict: flags.weaponConflict,
        conflictingArtifactIds: flags.conflictingArtifactIds,
      });
    } else {
      // The rule only needs one exception per effect (see the one above) --
      // both calls are batched into the same cascading render regardless.
      setReopenPicker({ teamId: draft.teamId, slotIndex: draft.slotIndex });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the sessionStorage draft in sync with `viewing` -- written
  // whenever a build is being viewed (including right as "View" is first
  // clicked, well before any navigation happens, so the draft is always
  // ready by the time a navigation-away actually occurs), cleared the
  // instant it closes for any other reason (the user's own close click,
  // "Select another build" moving on to a picker instead -- see below).
  useEffect(() => {
    if (viewing) {
      writeDraft({ kind: "viewing", teamId: viewing.teamId, slotIndex: viewing.slotIndex, buildId: viewing.buildId });
    } else {
      clearDraft();
    }
  }, [viewing]);

  // Same idea for a slot's own BuildSlotPicker -- TeamCard's
  // onPickerOpenChange fires this for ANY slot opening or closing, not
  // just a reopen-triggered one, so a plain manual click on a slot's own
  // card persists the draft exactly the same way "Select another build"
  // does. Only clears the draft if it still names THIS slot -- guards
  // against one slot's own close firing after a DIFFERENT slot has
  // already opened and overwritten the draft with its own entry.
  function handlePickerOpenChange(teamId: number, slotIndex: number, open: boolean) {
    if (open) {
      writeDraft({ kind: "selecting", teamId, slotIndex });
      return;
    }
    const current = readDraft();
    if (current && current.kind === "selecting" && current.teamId === teamId && current.slotIndex === slotIndex) {
      clearDraft();
    }
  }

  // Two separate boxes (see filterTeams' own comment on why they combine
  // as AND, not one shared box OR-ing team name against character name).
  const [teamNameSearch, setTeamNameSearch] = useState("");
  const [characterSearch, setCharacterSearch] = useState("");
  const [page, setPage] = useState(1);

  // While a specific group is selected (and NOT in group mode -- group
  // mode always shows the full list, see TeamCard's own groupSelection
  // prop comment on why everything needs to stay pickable then), the list
  // is scoped to exactly that group's own teams, in ITS saved order (see
  // GroupItem's own comment on why teamIds is already in that order) --
  // filterTeams only filters, never re-sorts, so search still narrows
  // within that order rather than disturbing it.
  const selectedGroup = selectedGroupId !== null ? groups.find((g) => g.id === selectedGroupId) : undefined;
  const displayedTeams =
    !inGroupMode && selectedGroup
      ? selectedGroup.teamIds
          .map((teamId) => teams.find((t) => t.id === teamId))
          .filter((team): team is TeamItem => team !== undefined)
      : // EDITING an existing group (not creating a new one -- see
        // handleCreateGroup/handleEditGroup's own groupId: null vs. a
        // real id) bumps every currently-selected team to the top of the
        // full list, in the draft's own order, so the teams the user
        // actually came here to review/change are immediately visible
        // instead of buried wherever they happen to sort naturally among
        // every OTHER team. Only while editing -- a brand-new group
        // starts with nothing selected, so there's nothing yet worth
        // bumping, and the user didn't ask for newly-picked teams to jump
        // around mid-create either. Array.prototype.sort is stable (ES
        // 2019+), so every unselected team keeps its own existing
        // relative order (comparator returns 0 for an unselected/
        // unselected pair) -- this only ever reorders selected-vs-
        // unselected, never two unselected teams against each other.
        groupDraft?.groupId !== null && groupDraft
          ? [...teams].sort((a, b) => {
              const aIndex = groupDraft.teamIds.indexOf(a.id);
              const bIndex = groupDraft.teamIds.indexOf(b.id);
              if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
              if (aIndex !== -1) return -1;
              if (bIndex !== -1) return 1;
              return 0;
            })
          : teams;

  const filtered = filterTeams(displayedTeams, teamNameSearch, characterSearch);
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);

  // No form, no modal -- see DEFAULT_TEAM_NAME's own comment. Errors from
  // CreateTeamSchema are effectively unreachable with a fixed, valid
  // literal name, but createTeam's return type still allows for them (a
  // future schema change might add a different kind of validation), so
  // this still checks rather than assuming success.
  function handleCreate() {
    startTransition(async () => {
      const result = await createTeam(DEFAULT_TEAM_NAME);
      if ("errors" in result) {
        notify(result.errors.name?.[0] ?? "Couldn't create a new team.", { title: "Can't create team" });
        return;
      }
      // Clears any active search (and resets to page 1) rather than
      // relying on DEFAULT_TEAM_NAME happening to match it -- a blank
      // name wouldn't have helped either, since an empty string still
      // never matches a non-empty query. Without this, creating a team
      // while a search is active could leave it filtered straight out of
      // view, reading as if nothing happened.
      setTeamNameSearch("");
      setCharacterSearch("");
      setPage(1);
      setTeams((prev) => [{ id: result.team.id, name: result.team.name, members: [] }, ...prev]);
      // Auto-selects a freshly created team into the in-progress group
      // draft, per the user's own request -- "New Team" is only even
      // visible right now because we're either in group mode or viewing
      // "All teams" (see its own render below), and only the group-mode
      // case needs this.
      if (groupDraft) {
        setGroupDraft((prev) => (prev ? { ...prev, teamIds: [...prev.teamIds, result.team.id] } : prev));
      }
    });
  }

  function handleCreateGroup() {
    setGroupDraft({ groupId: null, name: "New Group", teamIds: [] });
    setGroupSaveError(null);
  }

  function handleEditGroup() {
    if (!selectedGroup) return;
    setGroupDraft({ groupId: selectedGroup.id, name: selectedGroup.name, teamIds: [...selectedGroup.teamIds] });
    setGroupSaveError(null);
  }

  // Only deletes the Group/GroupTeam rows -- same as deleting a Team or
  // Collection, this never touches the teams themselves, just the saved
  // combination of them.
  async function handleDeleteGroup() {
    if (!selectedGroup) return;
    const groupId = selectedGroup.id;
    const confirmed = await confirm(`Delete the group "${selectedGroup.name}"? This can't be undone.`, {
      title: "Delete group",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(() => {
      const previous = groups;
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSelectedGroupId(null);
      deleteGroup(groupId).catch(() => setGroups(previous));
    });
  }

  function handleCancelGroupMode() {
    setGroupDraft(null);
    setGroupSaveError(null);
  }

  function handleToggleGroupTeam(teamId: number) {
    setGroupDraft((prev) => {
      if (!prev) return prev;
      // Splice out on deselect, append on select -- append (not insert at
      // the front) is what makes "order selected" mean what it says: a
      // team re-added after being removed goes back to the END of the
      // order, not its old position.
      const teamIds = prev.teamIds.includes(teamId)
        ? prev.teamIds.filter((id) => id !== teamId)
        : [...prev.teamIds, teamId];
      return { ...prev, teamIds };
    });
  }

  function handleSaveGroup() {
    if (!groupDraft) return;
    const draft = groupDraft;
    startTransition(async () => {
      const result =
        draft.groupId === null
          ? await createGroup(draft.name, draft.teamIds)
          : await updateGroup(draft.groupId, draft.name, draft.teamIds);
      if ("errors" in result) {
        setGroupSaveError(result.errors.name?.[0] ?? "Couldn't save this group.");
        return;
      }
      if ("error" in result) {
        setGroupSaveError(result.error);
        return;
      }
      const saved: GroupItem = { id: result.group.id, name: result.group.name, teamIds: draft.teamIds };
      setGroups((prev) => {
        const next = prev.some((g) => g.id === saved.id) ? prev.map((g) => (g.id === saved.id ? saved : g)) : [...prev, saved];
        return [...next].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedGroupId(saved.id);
      setGroupDraft(null);
      setGroupSaveError(null);
    });
  }

  function handleUpdateName(teamId: number, name: string) {
    const previous = teams;
    setTeams((prev) => updateTeamInPlace(prev, teamId, (team) => ({ ...team, name })));
    startTransition(() => {
      updateTeamName(teamId, name).catch(() => setTeams(previous));
    });
  }

  // Moves a team to the very top of the full list regardless of the
  // current page or search filter -- "move to front" always means the
  // top of the whole underlying order, not just within whatever's
  // currently visible, so this doesn't need to account for either.
  function handleBumpToFront(teamId: number) {
    const previous = teams;
    setTeams((prev) => {
      const index = prev.findIndex((team) => team.id === teamId);
      if (index === -1) return prev;
      return [prev[index], ...prev.slice(0, index), ...prev.slice(index + 1)];
    });
    startTransition(() => {
      bumpTeamToFront(teamId).catch(() => setTeams(previous));
    });
  }

  async function handleDelete(teamId: number) {
    const confirmed = await confirm("Delete this team? This can't be undone.", {
      title: "Delete team",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(() => {
      const previous = teams;
      setTeams((prev) => prev.filter((team) => team.id !== teamId));
      deleteTeam(teamId).catch(() => setTeams(previous));
    });
    // Deleting a team is reachable from group mode now too (see
    // groupSelection's own comment on why the card stays fully
    // interactive there) -- if it was part of the in-progress draft
    // selection, drop it from there as well, rather than leaving a
    // reference to a team that no longer exists for Save to trip over
    // later.
    if (groupDraft) {
      setGroupDraft((prev) => (prev ? { ...prev, teamIds: prev.teamIds.filter((id) => id !== teamId) } : prev));
    }
  }

  // Handles all three slot actions (add/remove/replace) through one path,
  // rather than three separate handlers. Replace is NOT remove-then-add
  // for the same slot any more (that was the old approach) -- it's its
  // own server call (replaceTeamBuild) that updates the existing
  // TeamBuild row in place, so the slot being replaced keeps its own
  // position (teamBuilds are rendered in id order -- see page.tsx's own
  // orderBy comment) instead of the new build landing at the end as a
  // freshly-created row would.
  function handleSlotChange(teamId: number, oldBuildId: number | null, newBuildId: number | null) {
    if (oldBuildId === newBuildId) return;
    const previous = teams;
    const newBuild = newBuildId !== null ? builds.find((b) => b.buildId === newBuildId) : undefined;

    setTeams((prev) =>
      updateTeamInPlace(prev, teamId, (team) => {
        if (oldBuildId !== null && newBuild) {
          // Replace -- same array index, not filter-then-push, so the
          // optimistic update matches what replaceTeamBuild actually does
          // server-side.
          return {
            ...team,
            members: team.members.map((m) =>
              m.buildId === oldBuildId
                ? {
                    buildId: newBuild.buildId,
                    name: newBuild.name,
                    characterName: newBuild.characterName,
                    characterIconUrl: newBuild.characterIconUrl,
                  }
                : m
            ),
          };
        }

        let members = team.members;
        if (oldBuildId !== null) members = members.filter((m) => m.buildId !== oldBuildId);
        if (newBuild) {
          members = [
            ...members,
            {
              buildId: newBuild.buildId,
              name: newBuild.name,
              characterName: newBuild.characterName,
              characterIconUrl: newBuild.characterIconUrl,
            },
          ];
        }
        return { ...team, members };
      })
    );

    startTransition(async () => {
      try {
        let result: AddTeamBuildResult | undefined;
        if (oldBuildId !== null && newBuildId !== null) {
          result = await replaceTeamBuild(teamId, oldBuildId, newBuildId);
        } else if (oldBuildId !== null) {
          await removeTeamBuild(teamId, oldBuildId);
        } else if (newBuildId !== null) {
          result = await addTeamBuild(teamId, newBuildId);
        }
        if (result && "error" in result) {
          notify(result.error, { title: "Can't add build" });
          setTeams(previous);
        }
      } catch {
        setTeams(previous);
      }
    });
  }

  // Drag-reordering two FILLED slots (empty slots aren't valid drag
  // sources or drop targets -- see TeamCard's own comment on why). A
  // plain two-element swap -- dropping slot 4 onto slot 2 exchanges
  // exactly those two, leaving 3 untouched -- not array-move/splice
  // semantics (which would shift everything between the two positions).
  function handleReorderSlots(teamId: number, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const members = [...team.members];
    [members[fromIndex], members[toIndex]] = [members[toIndex], members[fromIndex]];
    const newOrderedBuildIds = members.map((m) => m.buildId);

    const previous = teams;
    setTeams((prev) => updateTeamInPlace(prev, teamId, (t) => ({ ...t, members })));

    startTransition(async () => {
      try {
        const result = await reorderTeamBuilds(teamId, newOrderedBuildIds);
        if ("error" in result) {
          notify(result.error, { title: "Can't reorder" });
          setTeams(previous);
        }
      } catch {
        setTeams(previous);
      }
    });
  }

  return (
    <div className="space-y-3">
      {header}

      <div className="space-y-4">
        {/* Two separate boxes, not one shared one -- see filterTeams' own
            comment on why they combine as AND rather than either box
            matching either field. */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search by team name..."
            value={teamNameSearch}
            onChange={(event) => {
              setTeamNameSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <input
            type="text"
            placeholder="Search by character name..."
            value={characterSearch}
            onChange={(event) => {
              setCharacterSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 py-2 text-sm text-black"
          />
        </div>

        {/* "Group mode" -- see groupDraft's own comment. Replaces the
            dropdown/Create group/Edit group row entirely while active
            (switching groups mid-edit doesn't mean anything), rather than
            disabling it in place. */}
        {groupDraft ? (
          // border-red-500 (not always border-blue-500) once the draft
          // isn't currently savable -- either a live overlap conflict
          // (groupDraftConflicts' own comment) or the separate "must
          // contain at least one team" rule below -- same red-means-
          // "something's wrong" convention the team card's own conflict
          // border already uses, rather than staying blue regardless of
          // whether the draft is actually savable.
          <div
            className={`space-y-2 rounded-lg border bg-blue-500/5 p-3 ${
              groupDraftConflicts.length > 0 || groupDraft.teamIds.length === 0 ? "border-red-500" : "border-blue-500"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold" htmlFor="group-draft-name">
                Group name:
              </label>
              <input
                id="group-draft-name"
                type="text"
                autoFocus
                value={groupDraft.name}
                onChange={(event) => setGroupDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                className="w-64 rounded border bg-white px-2 py-1 text-sm text-black"
              />
              <span className="text-sm text-gray-500 dark:text-gray-300">
                {groupDraft.teamIds.length} team{groupDraft.teamIds.length === 1 ? "" : "s"} selected
              </span>
              <div className="ml-auto flex gap-2">
                {/* bg-white text-black (not a bare border like Edit/Create
                    group below) -- same solid-white treatment the
                    owned-weapons page's own bulk-select Cancel button
                    uses. A bare border read as faded here specifically
                    because this sits inside the group-mode panel's own
                    translucent bg-blue-500/5 wash, which a border/text
                    color with no fill of its own blends into; Edit/Create
                    group don't have this problem since they sit on the
                    plain page background instead. */}
                <button
                  type="button"
                  onClick={handleCancelGroupMode}
                  // hover:bg-gray-200 (not the barely-different gray-100
                  // tried first) -- needs a jump as visible as Save's own
                  // bg-black -> hover:bg-gray-800 right next to it, not a
                  // shade so close to the resting bg-white that the hover
                  // feedback all but disappears.
                  className="rounded border bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroup}
                  disabled={groupDraftConflicts.length > 0 || groupDraft.name.trim() === "" || groupDraft.teamIds.length === 0}
                  // disabled:cursor-not-allowed disabled:hover:bg-black --
                  // disabled:opacity-50 alone (the only thing here before)
                  // still looked clickable: a solid black button just
                  // reads as a slightly duller black, not obviously
                  // inert, and nothing stopped hover from still showing
                  // its own bg-gray-800 feedback. Same combination the
                  // owned-weapons page's own disabled bulk-delete button
                  // already uses (disabled:opacity-50 disabled:hover:bg-*
                  // reverting to the resting color), plus cursor-not-
                  // allowed (pagination-controls.tsx's own convention for
                  // the same signal).
                  className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-black"
                >
                  Save group
                </button>
              </div>
            </div>
            {/* Live, not a save-time response -- re-evaluated on every
                selection change (groupDraftConflicts' own comment), so
                this appears/disappears as teams are picked, not only
                after a failed Save attempt. One line per conflict, each
                naming the exact character/build/team on both sides (via
                describeGroupConflict) rather than a single generic
                sentence -- same build-name-italicized-in-parens
                convention a single team's own drifted-conflict warning
                already uses, with " in <team>" added since there's more
                than one team's worth of builds in play here.
                prioritizeGroupConflicts (not the raw list) is what's
                actually rendered -- the disabled check above still uses
                the unfiltered groupDraftConflicts, since Save should stay
                blocked by a suppressed weapon/artifact conflict too, only
                its own redundant message is hidden. */}
            {groupDraftConflicts.length > 0 && (
              <ul className="space-y-1 text-sm text-red-500">
                {prioritizeGroupConflicts(groupDraftConflicts).map((conflict, index) => (
                  <li key={index}>
                    {describeGroupConflict(conflict, teams, builds).map((part, partIndex) =>
                      part.type === "build" ? (
                        <span key={partIndex}>
                          {part.characterName} (<em>{part.buildName}</em>) in {part.teamName}
                        </span>
                      ) : (
                        <span key={partIndex}>{part.text}</span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* Can't co-occur with the conflict list above (a conflict
                needs at least 2 teams' worth of builds to begin with, so
                groupDraftConflicts is always empty here), but checked
                independently of it regardless -- this is a separate rule
                (a group has to contain SOMETHING), not another flavor of
                overlap conflict. */}
            {groupDraft.teamIds.length === 0 && <p className="text-sm text-red-500">A group must contain at least one team.</p>}
            {groupSaveError && <p className="text-sm text-red-500">{groupSaveError}</p>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedGroupId ?? ""}
              onChange={(event) => {
                setSelectedGroupId(event.target.value === "" ? null : Number(event.target.value));
                setPage(1);
              }}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="">All teams</option>
              {groups.map((group) => (
                // text-red-600 -- flags a saved group that's drifted into
                // conflict since it was last saved (groupConflictById's
                // own comment), without forcing the user to fix it before
                // viewing/using it -- the " (conflict)" suffix carries the
                // same signal for anyone who can't rely on the color alone.
                <option key={group.id} value={group.id} className={groupConflictById.get(group.id) ? "text-red-600" : undefined}>
                  {group.name}
                  {groupConflictById.get(group.id) ? " (conflict)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateGroup}
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
            >
              {/* PlusIcon, not the Unicode "+" -- see its own comment. */}
              <PlusIcon />
              <span className="leading-none">Create group</span>
            </button>
            {selectedGroup && (
              <>
                <button
                  type="button"
                  onClick={handleEditGroup}
                  className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Edit group
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  className="rounded-full border border-red-600 px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-600/10"
                >
                  Delete group
                </button>
              </>
            )}
          </div>
        )}

        {/* justify-between -- the count+Create group stays on the left
            (unchanged from before), and PaginationNavButtons joins on the
            right so Previous/Next are reachable from both the top and
            bottom of the list, not just the bottom (same grouped pair
            PaginationControls itself renders at the bottom). min-h-8 --
            PaginationNavButtons renders nothing at all below 10 teams
            (pageCount <= 1), so without a reserved height this row was
            only as tall as the count text/New Team button; crossing into
            a 2nd page then grew the row to fit the (taller) nav buttons,
            visibly shifting everything below it down. Pinning this row's
            own height up front means that growth never happens -- the
            nav buttons just fade into a row that was always big enough
            for them. */}
        <div className="flex min-h-8 items-center justify-between gap-3">
          {/* Sits right next to the count it immediately changes, not off
              at the far end of the row -- and not in the header row next
              to the title either (see Builds' own "Create build"), since
              that position implies opening something (a modal or a
              separate page), which this no longer does (see
              DEFAULT_TEAM_NAME's own comment: it's a single instant
              action with no form). A small pill (rounded-full, not the
              bordered rounded-lg "Create X" shape every other page uses)
              marks it as that different, lighter-weight kind of action
              rather than reusing a button shape that implies the same
              modal/page pattern. */}
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-300">
              {filtered.length} team{filtered.length === 1 ? "" : "s"}
            </p>
            {/* Hidden while viewing a specific group outside group mode --
                creating a plain team there wouldn't belong to the group
                being viewed, which would read as it silently vanishing.
                Still shown for "All teams" (selectedGroup undefined) and
                for group mode itself (inGroupMode), where a freshly
                created team is auto-selected into the draft (see
                handleCreate's own comment). */}
            {(inGroupMode || !selectedGroup) && (
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
              >
                {/* PlusIcon, not the Unicode "+" -- see its own comment. */}
                <PlusIcon />
                <span className="leading-none">New Team</span>
              </button>
            )}
          </div>

          <PaginationNavButtons currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>

        {/* Always 1 column, never the usual square-card multi-column grids
            -- each card now needs ~760px (4 h-44 slots plus gaps/padding)
            to keep its own 4 slots in one row without wrapping to 2x2, more
            than a 2nd/3rd column would leave on anything short of a very
            wide monitor. */}
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-500">No teams match this search.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4">
            {pageItems.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                builds={builds}
                onUpdateName={(name) => handleUpdateName(team.id, name)}
                onSlotChange={(oldBuildId, newBuildId) => handleSlotChange(team.id, oldBuildId, newBuildId)}
                onReorder={(fromIndex, toIndex) => handleReorderSlots(team.id, fromIndex, toIndex)}
                onView={(slotIndex, buildId, weaponConflict, conflictingArtifactIds) =>
                  setViewing({ teamId: team.id, slotIndex, buildId, weaponConflict, conflictingArtifactIds })
                }
                reopenSlotIndex={reopenPicker?.teamId === team.id ? reopenPicker.slotIndex : null}
                onReopenConsumed={() => setReopenPicker(null)}
                onPickerOpenChange={(slotIndex, open) => handlePickerOpenChange(team.id, slotIndex, open)}
                onBumpToFront={() => handleBumpToFront(team.id)}
                onDelete={() => handleDelete(team.id)}
                groupSelection={
                  groupDraft
                    ? { selected: groupDraft.teamIds.includes(team.id), onToggle: () => handleToggleGroupTeam(team.id) }
                    : undefined
                }
              />
            ))}
          </ul>
        )}

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </div>

      <BuildDetailModal
        buildId={viewing?.buildId ?? null}
        weaponConflict={viewing?.weaponConflict ?? false}
        conflictingArtifactIds={viewing?.conflictingArtifactIds ?? []}
        selectAction={
          viewing
            ? {
                label: "Select another build",
                onClick: () => {
                  setReopenPicker({ teamId: viewing.teamId, slotIndex: viewing.slotIndex });
                  setViewing(null);
                },
              }
            : undefined
        }
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
