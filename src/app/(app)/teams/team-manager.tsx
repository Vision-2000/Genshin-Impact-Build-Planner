"use client";

import { useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { computeElementalResonances } from "@/lib/elemental-resonance";
import { computeMoonsignHexereiEffects } from "@/lib/moonsign-hexerei";
import { paginate } from "@/lib/paginate";
import type { TeamEffect } from "@/lib/team-effect";
import { useDialogs } from "@/components/dialog-provider";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";
import { ELEMENT_ICON_URL } from "../characters/element-icons";
import { PaginationControls } from "../pagination-controls";
import { createTeam, updateTeamName, deleteTeam, addTeamBuild, removeTeamBuild, bumpTeamToFront } from "./actions";
import { MAX_TEAM_SIZE, filterTeams, toOverlapCheckBuild, type BuildOption, type TeamItem } from "./filter-sort";
import { BuildSlotPicker } from "./build-slot-picker";

const PAGE_SIZE = 9;
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
      // max-w-xs (not flex-1 alone) -- flex-1 used to be harmless when the
      // team card itself was narrow (a multi-column grid), but now that
      // the card spans the full page width (see the "always 1 column"
      // comment below) it stretched this into an absurdly wide text box.
      className="min-w-0 max-w-xs flex-1 rounded border bg-white px-2 pb-0.5 pt-1.5 text-sm font-medium text-black"
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
  onBumpToFront,
  onDelete,
}: {
  team: TeamItem;
  builds: BuildOption[];
  onUpdateName: (name: string) => void;
  onSlotChange: (oldBuildId: number | null, newBuildId: number | null) => void;
  onBumpToFront: () => void;
  onDelete: () => void;
}) {
  const slotBuildIds: (number | null)[] = [
    ...team.members.map((m) => m.buildId),
    ...Array(Math.max(0, MAX_TEAM_SIZE - team.members.length)).fill(null),
  ].slice(0, MAX_TEAM_SIZE);

  // Elemental Resonance and Team Effects (Moonsign/Hexerei) both only
  // care about which builds are actually in the team right now, not
  // which slot they're in -- built straight from team.members (not
  // slotBuildIds, which pads with nulls purely for rendering 4 slot
  // positions).
  const memberBuilds = team.members
    .map((member) => builds.find((build) => build.buildId === member.buildId))
    .filter((build): build is BuildOption => build !== undefined);
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

  return (
    <li className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        {/* Grouped with the name field (not a 3rd justify-between sibling
            of its own) so the icons sit right next to it instead of
            floating centered in whatever space is left over -- that
            leftover space goes between this whole group and the Delete
            button instead. Each icon is hidden outright (not an empty
            placeholder) when it isn't active, since most teams won't have
            every one of these at once. */}
        <div className="flex min-w-0 items-center gap-2">
          <TeamNameInput value={team.name} onCommit={onUpdateName} />

          {/* One black pill PER active resonance (not one shared pill for
              all of them) -- each pill shows that resonance's own element
              icon twice, since the resonance is what having 2 of that
              element in the party actually means. Up to 2 can be active
              on a 4-build team (computeElementalResonances' own comment),
              so this is at most 2 side-by-side pills, never a long row. */}
          {resonances.map((effect) => (
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
          ))}

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
              <div className="relative h-10 w-10 overflow-hidden rounded-full">
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
            onClick={onBumpToFront}
            title="Move to top"
            className="rounded border border-white bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            Move to top
          </button>
          {/* py-1.5 (symmetric, no nudge) -- not the usual pt-2/pb-1
              every other Delete button in this app uses. Both pt-2/pb-1
              and a halved pt-[7px]/pb-[5px] still read as too low here,
              confirmed visually each time, even though the className is
              otherwise identical to buttons where pt-2/pb-1 looks right.
              Same root cause as the set-effect badge rows in
              build-stats-summary.tsx: the "correct" nudge amount isn't a
              font constant, it's sensitive to this specific element's
              own sub-pixel position, so it can genuinely need a
              different (here, no) correction in a different layout
              context. If this is still off, the fix may need to go the
              other direction entirely (more bottom padding than top),
              which no other instance in this app has ever needed. */}
          <button
            type="button"
            onClick={onDelete}
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

          return (
            <BuildSlotPicker
              key={index}
              builds={builds}
              otherOverlapBuilds={otherBuilds}
              value={buildId}
              onChange={(newBuildId) => onSlotChange(buildId, newBuildId)}
              boxSizeClassName={SLOT_SIZE_CLASS}
            />
          );
        })}
      </div>
    </li>
  );
}

export function TeamManager({
  header,
  builds,
  initialTeams,
}: {
  // The page's own title block -- same reasoning as OwnedBuildManager's
  // own header prop (see page.tsx's own comment): "Create team" drives
  // client state (even though it no longer opens a modal, see
  // DEFAULT_TEAM_NAME's own comment), so the row holding both lives here.
  header: ReactNode;
  builds: BuildOption[];
  initialTeams: TeamItem[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [, startTransition] = useTransition();
  const { confirm, notify } = useDialogs();

  // Two separate boxes (see filterTeams' own comment on why they combine
  // as AND, not one shared box OR-ing team name against character name).
  const [teamNameSearch, setTeamNameSearch] = useState("");
  const [characterSearch, setCharacterSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = filterTeams(teams, teamNameSearch, characterSearch);
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
  }

  // Handles all three slot actions (add/remove/replace) through one path,
  // rather than the three separate handlers this replaced -- a replace is
  // just a remove and an add for the same slot, and sequencing those two
  // server calls matters: addTeamBuild's own server-side 4-build check
  // would otherwise race against a still-in-flight removeTeamBuild for
  // the build being swapped out, if the two fired independently (as the
  // old handleAddBuild/handleRemoveBuild pair would have here). Applies
  // both halves of the optimistic update together, then awaits the
  // remove before the add so the server always sees the slot as already
  // freed.
  function handleSlotChange(teamId: number, oldBuildId: number | null, newBuildId: number | null) {
    if (oldBuildId === newBuildId) return;
    const previous = teams;
    const newBuild = newBuildId !== null ? builds.find((b) => b.buildId === newBuildId) : undefined;

    setTeams((prev) =>
      updateTeamInPlace(prev, teamId, (team) => {
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
        if (oldBuildId !== null) await removeTeamBuild(teamId, oldBuildId);
        if (newBuildId !== null) {
          const result = await addTeamBuild(teamId, newBuildId);
          if ("error" in result) {
            notify(result.error, { title: "Can't add build" });
            setTeams(previous);
          }
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
            className="w-72 rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
          />
          <input
            type="text"
            placeholder="Search by character name..."
            value={characterSearch}
            onChange={(event) => {
              setCharacterSearch(event.target.value);
              setPage(1);
            }}
            className="w-72 rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
          />
        </div>

        {/* Sits right next to the count it immediately changes, not off
            at the far end of the row -- and not in the header row next
            to the title either (see Builds' own "Create build"), since
            that position implies opening something (a modal or a
            separate page), which this no longer does (see
            DEFAULT_TEAM_NAME's own comment: it's a single instant action
            with no form). A small pill (rounded-full, not the bordered
            rounded-lg "Create X" shape every other page uses) marks it
            as that different, lighter-weight kind of action rather than
            reusing a button shape that implies the same modal/page
            pattern. */}
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {filtered.length} team{filtered.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:bg-black/5"
          >
            <span className="text-sm leading-none">+</span> New Team
          </button>
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
                onBumpToFront={() => handleBumpToFront(team.id)}
                onDelete={() => handleDelete(team.id)}
              />
            ))}
          </ul>
        )}

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </div>
    </div>
  );
}
