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
import { createTeam, updateTeamName, deleteTeam, addTeamBuild, removeTeamBuild } from "./actions";
import { MAX_TEAM_SIZE, filterTeams, toOverlapCheckBuild, type BuildOption, type TeamItem } from "./filter-sort";
import { BuildSlotPicker } from "./build-slot-picker";

const PAGE_SIZE = 9;
// A 3-wide/2-tall rectangle, not a square -- matches BuildPortrait's own
// aspect ratio (see build-slot-picker.tsx's own comment on why a filled
// slot uses BuildPortrait instead of a square CharacterCard at all: a
// small circular weapon/set-effect badge turned out to be too small to
// actually read). w-96 at aspect-[3/2] works out to a 384x256 box -- each
// of BuildPortrait's own weapon/artifact-effects icons is a third of that
// width (~128px). The card grid is a single column (see the "always 1
// column" comment below), so there's no column width to stay under.
const SLOT_SIZE_CLASS = "aspect-[3/2] w-96";
// A team is a perfectly valid, real in-game state with 0 builds in it (a
// party slot can sit empty) -- "Create team" no longer prompts for a name
// up front, it just makes one of these immediately and lets
// TeamNameInput's own inline rename handle the rest, the same way a build
// slot starts empty and gets filled in afterward rather than demanding
// everything up front.
const DEFAULT_TEAM_NAME = "New Team";

// Reorders `teams` so the one matching `teamId` (after `updater` is
// applied to it) moves to the front -- mirrors Team.updatedAt actually
// changing server-side (every mutation here has a matching server action
// that touches it, see actions.ts's own comments), so the client's own
// "most recently updated first" order stays live without waiting for a
// refetch. A no-op (returns `teams` unchanged) if teamId isn't found,
// which shouldn't happen in practice but is cheap to guard against.
function touchTeam(teams: TeamItem[], teamId: number, updater: (team: TeamItem) => TeamItem): TeamItem[] {
  const index = teams.findIndex((team) => team.id === teamId);
  if (index === -1) return teams;
  const updated = updater(teams[index]);
  return [updated, ...teams.slice(0, index), ...teams.slice(index + 1)];
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
      className="min-w-0 flex-1 rounded border bg-white px-2 pb-0.5 pt-1.5 text-sm font-medium text-black"
    />
  );
}

// Same dark-box/single-whole-box-tooltip pattern as BuildStatsSummary's
// own Artifact Set Effects box -- the face shows just the effect name(s)
// + element icon (when one applies), the full effect text is one hover
// away. Extracted once a second TeamCard box (Team Effects, alongside
// Elemental Resonance) needed the exact same shape, same reasoning as
// this app's own useToast/Toast extraction once a second page needed
// that pattern. At most 2-3 entries can ever be active at once on a
// 4-build team (see computeElementalResonances'/
// computeMoonsignHexereiEffects' own comments), so this never needs to
// handle a long list.
function TeamEffectBox({ title, effects, emptyText }: { title: string; effects: TeamEffect[]; emptyText: string }) {
  if (effects.length === 0) {
    return (
      <div className="rounded border bg-black p-4 pt-2 text-base">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-gray-400">{emptyText}</p>
      </div>
    );
  }

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
      <div className="rounded border bg-black p-4 pt-2 text-base">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <ul className="mt-2 flex flex-col gap-y-1">
          {effects.map((effect) => (
            <li key={effect.name} className="flex items-center gap-1.5 text-foreground">
              {effect.element && <Image src={ELEMENT_ICON_URL[effect.element]} alt="" width={20} height={20} />}
              <span>{effect.name}</span>
            </li>
          ))}
        </ul>
      </div>
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
  onDelete,
}: {
  team: TeamItem;
  builds: BuildOption[];
  onUpdateName: (name: string) => void;
  onSlotChange: (oldBuildId: number | null, newBuildId: number | null) => void;
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
  const teamEffects = computeMoonsignHexereiEffects({
    moonsignCount: memberBuilds.filter((build) => build.isMoonsignCharacter).length,
    hexereiCount: memberBuilds.filter((build) => build.isHexereiCharacter).length,
  });

  return (
    <li className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <TeamNameInput value={team.name} onCommit={onUpdateName} />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-gray-500">
            {team.members.length}/{MAX_TEAM_SIZE}
          </span>
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TeamEffectBox title="Elemental Resonance" effects={resonances} emptyText="No elemental resonance active yet." />
        <TeamEffectBox title="Team Effects" effects={teamEffects} emptyText="No team effects active yet." />
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

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = filterTeams(teams, search);
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
      setSearch("");
      setPage(1);
      setTeams((prev) => [{ id: result.team.id, name: result.team.name, members: [] }, ...prev]);
    });
  }

  function handleUpdateName(teamId: number, name: string) {
    const previous = teams;
    setTeams((prev) => touchTeam(prev, teamId, (team) => ({ ...team, name })));
    startTransition(() => {
      updateTeamName(teamId, name).catch(() => setTeams(previous));
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
      touchTeam(prev, teamId, (team) => {
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
        <input
          type="text"
          placeholder="Search by team or character name..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-72 rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
        />

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
