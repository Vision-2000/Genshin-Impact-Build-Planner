"use client";

import { useState, useTransition, type ReactNode } from "react";
import { paginate } from "@/lib/paginate";
import { Modal } from "@/components/modal";
import { useDialogs } from "@/components/dialog-provider";
import { PaginationControls } from "../pagination-controls";
import { createTeam, updateTeamName, deleteTeam, addTeamBuild, removeTeamBuild } from "./actions";
import type { CreateTeamErrors } from "./schemas";
import { MAX_TEAM_SIZE, filterTeams, toOverlapCheckBuild, type BuildOption, type TeamItem } from "./filter-sort";
import { BuildSlotPicker } from "./build-slot-picker";

const PAGE_SIZE = 9;
// Compact size for a team card's own 4 slots -- smaller than the usual
// 224x224 default (same reasoning as Builds' own SLOT_SIZE_CLASS): a card
// needs to fit 4 of these side by side, plus its own name row, inside a
// grid cell.
const SLOT_SIZE_CLASS = "h-28 w-28";

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

  return (
    <li className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <TeamNameInput value={team.name} onCommit={onUpdateName} />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-gray-500">
            {team.members.length}/{MAX_TEAM_SIZE}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-600 px-3 pb-1 pt-2 text-xs font-semibold text-white hover:bg-red-700"
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
  // own header prop (see page.tsx's own comment): "Create team" opens a
  // modal driven by client state, so the row holding both lives here.
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

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createErrors, setCreateErrors] = useState<CreateTeamErrors>({});

  function closeCreate() {
    setCreating(false);
    setCreateName("");
    setCreateErrors({});
  }

  function handleCreateSubmit() {
    startTransition(async () => {
      const result = await createTeam(createName);
      if ("errors" in result) {
        setCreateErrors(result.errors);
        return;
      }
      setTeams((prev) => [...prev, { id: result.team.id, name: result.team.name, members: [] }]);
      closeCreate();
    });
  }

  function handleUpdateName(teamId: number, name: string) {
    const previous = teams;
    setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, name } : team)));
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
      prev.map((team) => {
        if (team.id !== teamId) return team;
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
      <div className="flex items-center justify-between gap-3">
        {header}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
        >
          <span className="text-base leading-none">+</span> Create team
        </button>
      </div>

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

        <p className="text-sm text-gray-500 dark:text-gray-300">
          {filtered.length} team{filtered.length === 1 ? "" : "s"}
        </p>

        {/* grid-cols-1/2/3 (not the usual square-card 5-6 column grids) --
            each card is much wider than a single icon, needing room for
            its own name row plus 4 slot boxes side by side. */}
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-500">No teams match this search.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
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

      <Modal open={creating} onClose={closeCreate} title="Create a team" maxWidthClassName="max-w-sm">
        <div className="space-y-3">
          <label className="block text-sm">
            Name:
            <input
              type="text"
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="e.g. National Team"
              className="ml-1 rounded border bg-white px-2 pb-0.5 pt-1.5 text-sm text-black"
            />
          </label>
          {createErrors.name && <p className="text-sm text-red-600">{createErrors.name[0]}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreateSubmit}
              className="rounded border border-white bg-black px-3 pb-1 pt-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              Create team
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
