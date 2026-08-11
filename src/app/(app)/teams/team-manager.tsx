"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { paginate } from "@/lib/paginate";
import { detectOverlaps } from "@/lib/overlap";
import { PaginationControls } from "../pagination-controls";
import { createTeam, updateTeamName, deleteTeam, addTeamBuild, removeTeamBuild } from "./actions";
import type { CreateTeamErrors } from "./schemas";
import { MAX_TEAM_SIZE, filterTeams, toOverlapCheckBuild, type BuildOption, type TeamItem } from "./filter-sort";

const PAGE_SIZE = 10;

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
      className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm font-medium text-black"
    />
  );
}

function TeamCard({
  team,
  builds,
  onUpdateName,
  onAddBuild,
  onRemoveBuild,
  onDelete,
}: {
  team: TeamItem;
  builds: BuildOption[];
  onUpdateName: (name: string) => void;
  onAddBuild: (buildId: number) => void;
  onRemoveBuild: (buildId: number) => void;
  onDelete: () => void;
}) {
  const memberBuildIds = new Set(team.members.map((m) => m.buildId));
  const currentOverlapBuilds = team.members
    .map((member) => builds.find((build) => build.buildId === member.buildId))
    .filter((build): build is BuildOption => !!build)
    .map(toOverlapCheckBuild);

  const isFull = team.members.length >= MAX_TEAM_SIZE;
  const availableBuilds = isFull
    ? []
    : builds.filter((build) => {
        if (memberBuildIds.has(build.buildId)) return false;
        return detectOverlaps([...currentOverlapBuilds, toOverlapCheckBuild(build)]).length === 0;
      });

  return (
    <li className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        <TeamNameInput value={team.name} onCommit={onUpdateName} />
        <span className="text-xs text-gray-500">
          {team.members.length}/{MAX_TEAM_SIZE}
        </span>
        <button type="button" onClick={onDelete} className="text-xs text-red-600 underline">
          Delete
        </button>
      </div>

      <ul className="space-y-1">
        {team.members.map((member) => (
          <li key={member.buildId} className="flex items-center gap-2 text-xs">
            {member.characterIconUrl && <Image src={member.characterIconUrl} alt="" width={24} height={24} />}
            <span>
              {member.characterName} — {member.name}
            </span>
            <button
              type="button"
              onClick={() => onRemoveBuild(member.buildId)}
              className="text-red-600 underline"
            >
              Remove
            </button>
          </li>
        ))}
        {team.members.length === 0 && <p className="text-xs text-gray-500">No builds yet.</p>}
      </ul>

      {!isFull && (
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) onAddBuild(Number(event.target.value));
            event.target.value = "";
          }}
          className="rounded border bg-white px-2 py-1 text-xs text-black"
        >
          <option value="" disabled>
            + Add build
          </option>
          {availableBuilds.map((build) => (
            <option key={build.buildId} value={build.buildId}>
              {build.characterName} — {build.name}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}

export function TeamManager({ builds, initialTeams }: { builds: BuildOption[]; initialTeams: TeamItem[] }) {
  const [teams, setTeams] = useState(initialTeams);
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = filterTeams(teams, search);
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);

  const [createName, setCreateName] = useState("");
  const [createErrors, setCreateErrors] = useState<CreateTeamErrors>({});

  function handleCreateSubmit() {
    startTransition(async () => {
      const result = await createTeam(createName);
      if ("errors" in result) {
        setCreateErrors(result.errors);
        return;
      }
      setTeams((prev) => [...prev, { id: result.team.id, name: result.team.name, members: [] }]);
      setCreateErrors({});
      setCreateName("");
    });
  }

  function handleUpdateName(teamId: number, name: string) {
    const previous = teams;
    setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, name } : team)));
    startTransition(() => {
      updateTeamName(teamId, name).catch(() => setTeams(previous));
    });
  }

  function handleDelete(teamId: number) {
    if (!window.confirm("Delete this team? This can't be undone.")) return;
    const previous = teams;
    setTeams((prev) => prev.filter((team) => team.id !== teamId));
    startTransition(() => {
      deleteTeam(teamId).catch(() => setTeams(previous));
    });
  }

  function handleAddBuild(teamId: number, buildId: number) {
    startTransition(async () => {
      const result = await addTeamBuild(teamId, buildId);
      if ("error" in result) {
        window.alert(result.error);
        return;
      }
      setTeams((prev) =>
        prev.map((team) => (team.id === teamId ? { ...team, members: [...team.members, result.member] } : team))
      );
    });
  }

  function handleRemoveBuild(teamId: number, buildId: number) {
    const previous = teams;
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId ? { ...team, members: team.members.filter((m) => m.buildId !== buildId) } : team
      )
    );
    startTransition(() => {
      removeTeamBuild(teamId, buildId).catch(() => setTeams(previous));
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your teams</h2>

        <input
          type="text"
          placeholder="Search by team or character name..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />

        <p className="text-sm text-gray-500">
          {filtered.length} team{filtered.length === 1 ? "" : "s"}
        </p>

        <ul className="space-y-2">
          {pageItems.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              builds={builds}
              onUpdateName={(name) => handleUpdateName(team.id, name)}
              onAddBuild={(buildId) => handleAddBuild(team.id, buildId)}
              onRemoveBuild={(buildId) => handleRemoveBuild(team.id, buildId)}
              onDelete={() => handleDelete(team.id)}
            />
          ))}
          {pageItems.length === 0 && <p className="text-sm text-gray-500">No teams match this search.</p>}
        </ul>

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Create a team</h2>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="e.g. National Team"
            className="rounded border bg-white px-2 py-1 text-sm text-black"
          />
          <button
            type="button"
            onClick={handleCreateSubmit}
            className="rounded bg-black px-3 py-1 text-xs text-white"
          >
            Create team
          </button>
        </div>
        {createErrors.name && <p className="text-xs text-red-600">{createErrors.name[0]}</p>}
      </section>
    </div>
  );
}
