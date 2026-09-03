"use client";

import { useState, useTransition } from "react";
import { paginate } from "@/lib/paginate";
import { detectOverlaps } from "@/lib/overlap";
import { useDialogs } from "@/components/dialog-provider";
import { PaginationControls } from "../pagination-controls";
import { createLineup, updateLineupName, deleteLineup, addLineupTeam, removeLineupTeam } from "./actions";
import type { CreateLineupErrors } from "./schemas";
import { filterLineups, combinedOverlapBuilds, type TeamOption, type LineupItem } from "./filter-sort";

const PAGE_SIZE = 10;

function LineupNameInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
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
      className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm font-medium text-black"
    />
  );
}

function LineupCard({
  lineup,
  teams,
  onUpdateName,
  onAddTeam,
  onRemoveTeam,
  onDelete,
}: {
  lineup: LineupItem;
  teams: TeamOption[];
  onUpdateName: (name: string) => void;
  onAddTeam: (teamId: number) => void;
  onRemoveTeam: (teamId: number) => void;
  onDelete: () => void;
}) {
  const memberTeamIds = lineup.members.map((m) => m.teamId);
  const memberTeamIdSet = new Set(memberTeamIds);
  const currentBuilds = combinedOverlapBuilds(teams, memberTeamIds);
  const hasConflict = detectOverlaps(currentBuilds).length > 0;

  const availableTeams = teams.filter((team) => {
    if (memberTeamIdSet.has(team.teamId)) return false;
    return detectOverlaps([...currentBuilds, ...team.builds]).length === 0;
  });

  return (
    <li className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        <LineupNameInput value={lineup.name} onCommit={onUpdateName} />
        <span className="text-xs text-gray-500">{lineup.members.length} teams</span>
        <button type="button" onClick={onDelete} className="text-xs text-red-600 underline">
          Delete
        </button>
      </div>

      {hasConflict && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          This lineup currently has a conflict between its teams (a shared character, weapon, or artifact) — one of
          the teams must have changed since this was saved. Remove a team to resolve it.
        </p>
      )}

      <ul className="space-y-1">
        {lineup.members.map((member) => (
          <li key={member.teamId} className="flex items-center gap-2 text-xs">
            <span>{member.teamName}</span>
            <button type="button" onClick={() => onRemoveTeam(member.teamId)} className="text-red-600 underline">
              Remove
            </button>
          </li>
        ))}
        {lineup.members.length === 0 && <p className="text-xs text-gray-500">No teams yet.</p>}
      </ul>

      <select
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) onAddTeam(Number(event.target.value));
          event.target.value = "";
        }}
        className="rounded border bg-white px-2 py-1 text-xs text-black"
      >
        <option value="" disabled>
          + Add team
        </option>
        {availableTeams.map((team) => (
          <option key={team.teamId} value={team.teamId}>
            {team.name}
          </option>
        ))}
      </select>
    </li>
  );
}

export function LineupManager({ teams, initialLineups }: { teams: TeamOption[]; initialLineups: LineupItem[] }) {
  const [lineups, setLineups] = useState(initialLineups);
  const [, startTransition] = useTransition();
  const { confirm, notify } = useDialogs();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = filterLineups(lineups, search);
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);

  const [createName, setCreateName] = useState("");
  const [createErrors, setCreateErrors] = useState<CreateLineupErrors>({});

  function handleCreateSubmit() {
    startTransition(async () => {
      const result = await createLineup(createName);
      if ("errors" in result) {
        setCreateErrors(result.errors);
        return;
      }
      setLineups((prev) => [...prev, { id: result.lineup.id, name: result.lineup.name, members: [] }]);
      setCreateErrors({});
      setCreateName("");
    });
  }

  function handleUpdateName(lineupId: number, name: string) {
    const previous = lineups;
    setLineups((prev) => prev.map((lineup) => (lineup.id === lineupId ? { ...lineup, name } : lineup)));
    startTransition(() => {
      updateLineupName(lineupId, name).catch(() => setLineups(previous));
    });
  }

  async function handleDelete(lineupId: number) {
    const confirmed = await confirm("Delete this lineup? This can't be undone.", {
      title: "Delete lineup",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(() => {
      const previous = lineups;
      setLineups((prev) => prev.filter((lineup) => lineup.id !== lineupId));
      deleteLineup(lineupId).catch(() => setLineups(previous));
    });
  }

  function handleAddTeam(lineupId: number, teamId: number) {
    startTransition(async () => {
      const result = await addLineupTeam(lineupId, teamId);
      if ("error" in result) {
        notify(result.error, { title: "Can't add team" });
        return;
      }
      setLineups((prev) =>
        prev.map((lineup) =>
          lineup.id === lineupId ? { ...lineup, members: [...lineup.members, result.member] } : lineup
        )
      );
    });
  }

  function handleRemoveTeam(lineupId: number, teamId: number) {
    const previous = lineups;
    setLineups((prev) =>
      prev.map((lineup) =>
        lineup.id === lineupId
          ? { ...lineup, members: lineup.members.filter((m) => m.teamId !== teamId) }
          : lineup
      )
    );
    startTransition(() => {
      removeLineupTeam(lineupId, teamId).catch(() => setLineups(previous));
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your lineups</h2>

        <input
          type="text"
          placeholder="Search by lineup or team name..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />

        <p className="text-sm text-gray-500">
          {filtered.length} lineup{filtered.length === 1 ? "" : "s"}
        </p>

        <ul className="space-y-2">
          {pageItems.map((lineup) => (
            <LineupCard
              key={lineup.id}
              lineup={lineup}
              teams={teams}
              onUpdateName={(name) => handleUpdateName(lineup.id, name)}
              onAddTeam={(teamId) => handleAddTeam(lineup.id, teamId)}
              onRemoveTeam={(teamId) => handleRemoveTeam(lineup.id, teamId)}
              onDelete={() => handleDelete(lineup.id)}
            />
          ))}
          {pageItems.length === 0 && <p className="text-sm text-gray-500">No lineups match this search.</p>}
        </ul>

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Create a lineup</h2>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="e.g. Abyss Floor 12"
            className="rounded border bg-white px-2 py-1 text-sm text-black"
          />
          <button
            type="button"
            onClick={handleCreateSubmit}
            className="rounded bg-black px-3 py-1 text-xs text-white"
          >
            Create lineup
          </button>
        </div>
        {createErrors.name && <p className="text-xs text-red-600">{createErrors.name[0]}</p>}
      </section>
    </div>
  );
}
