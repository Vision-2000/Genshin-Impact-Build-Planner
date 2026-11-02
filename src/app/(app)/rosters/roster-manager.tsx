"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { paginate } from "@/lib/paginate";
import { detectOverlaps } from "@/lib/overlap";
import { useDialogs } from "@/components/dialog-provider";
import { PaginationControls, PaginationNavButtons } from "../pagination-controls";
import { createRoster, updateRosterName, deleteRoster, addRosterBuild, removeRosterBuild } from "./actions";
import type { CreateRosterErrors } from "./schemas";
import { filterRosters, toOverlapCheckBuild, type BuildOption, type RosterItem } from "./filter-sort";

const PAGE_SIZE = 10;

function RosterNameInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
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

function RosterCard({
  roster,
  builds,
  onUpdateName,
  onAddBuild,
  onRemoveBuild,
  onDelete,
}: {
  roster: RosterItem;
  builds: BuildOption[];
  onUpdateName: (name: string) => void;
  onAddBuild: (buildId: number) => void;
  onRemoveBuild: (buildId: number) => void;
  onDelete: () => void;
}) {
  const memberBuildIds = new Set(roster.members.map((m) => m.buildId));
  const currentOverlapBuilds = roster.members
    .map((member) => builds.find((build) => build.buildId === member.buildId))
    .filter((build): build is BuildOption => !!build)
    .map(toOverlapCheckBuild);

  const availableBuilds = builds.filter((build) => {
    if (memberBuildIds.has(build.buildId)) return false;
    return detectOverlaps([...currentOverlapBuilds, toOverlapCheckBuild(build)]).length === 0;
  });

  return (
    <li className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        <RosterNameInput value={roster.name} onCommit={onUpdateName} />
        <span className="text-xs text-gray-500">{roster.members.length} builds</span>
        <button type="button" onClick={onDelete} className="text-xs text-red-600 underline">
          Delete
        </button>
      </div>

      <ul className="space-y-1">
        {roster.members.map((member) => (
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
        {roster.members.length === 0 && <p className="text-xs text-gray-500">No builds yet.</p>}
      </ul>

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
    </li>
  );
}

export function RosterManager({ builds, initialRosters }: { builds: BuildOption[]; initialRosters: RosterItem[] }) {
  const [rosters, setRosters] = useState(initialRosters);
  const [, startTransition] = useTransition();
  const { confirm, notify } = useDialogs();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = filterRosters(rosters, search);
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);

  const [createName, setCreateName] = useState("");
  const [createErrors, setCreateErrors] = useState<CreateRosterErrors>({});

  function handleCreateSubmit() {
    startTransition(async () => {
      const result = await createRoster(createName);
      if ("errors" in result) {
        setCreateErrors(result.errors);
        return;
      }
      setRosters((prev) => [...prev, { id: result.roster.id, name: result.roster.name, members: [] }]);
      setCreateErrors({});
      setCreateName("");
    });
  }

  function handleUpdateName(rosterId: number, name: string) {
    const previous = rosters;
    setRosters((prev) => prev.map((roster) => (roster.id === rosterId ? { ...roster, name } : roster)));
    startTransition(() => {
      updateRosterName(rosterId, name).catch(() => setRosters(previous));
    });
  }

  async function handleDelete(rosterId: number) {
    const confirmed = await confirm("Delete this roster? This can't be undone.", {
      title: "Delete roster",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(() => {
      const previous = rosters;
      setRosters((prev) => prev.filter((roster) => roster.id !== rosterId));
      deleteRoster(rosterId).catch(() => setRosters(previous));
    });
  }

  function handleAddBuild(rosterId: number, buildId: number) {
    startTransition(async () => {
      const result = await addRosterBuild(rosterId, buildId);
      if ("error" in result) {
        notify(result.error, { title: "Can't add build" });
        return;
      }
      setRosters((prev) =>
        prev.map((roster) =>
          roster.id === rosterId ? { ...roster, members: [...roster.members, result.member] } : roster
        )
      );
    });
  }

  function handleRemoveBuild(rosterId: number, buildId: number) {
    const previous = rosters;
    setRosters((prev) =>
      prev.map((roster) =>
        roster.id === rosterId
          ? { ...roster, members: roster.members.filter((m) => m.buildId !== buildId) }
          : roster
      )
    );
    startTransition(() => {
      removeRosterBuild(rosterId, buildId).catch(() => setRosters(previous));
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your rosters</h2>

        <input
          type="text"
          placeholder="Search by roster or character name..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border bg-white px-3 pb-1.5 pt-2.5 text-sm text-black"
        />

        {/* min-h-8 -- same fix as the Teams/Builds pages' own top row:
            without a reserved height, crossing into a 2nd page grows this
            row (PaginationNavButtons' own buttons are taller than the
            count text alone) and visibly shifts the list below it down. */}
        <div className="flex min-h-8 items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {filtered.length} roster{filtered.length === 1 ? "" : "s"}
          </p>
          <PaginationNavButtons currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>

        <ul className="space-y-2">
          {pageItems.map((roster) => (
            <RosterCard
              key={roster.id}
              roster={roster}
              builds={builds}
              onUpdateName={(name) => handleUpdateName(roster.id, name)}
              onAddBuild={(buildId) => handleAddBuild(roster.id, buildId)}
              onRemoveBuild={(buildId) => handleRemoveBuild(roster.id, buildId)}
              onDelete={() => handleDelete(roster.id)}
            />
          ))}
          {pageItems.length === 0 && <p className="text-sm text-gray-500">No rosters match this search.</p>}
        </ul>

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Create a roster</h2>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="e.g. Abyss Roster"
            className="rounded border bg-white px-2 py-1 text-sm text-black"
          />
          <button
            type="button"
            onClick={handleCreateSubmit}
            className="rounded bg-black px-3 py-1 text-xs text-white"
          >
            Create roster
          </button>
        </div>
        {createErrors.name && <p className="text-xs text-red-600">{createErrors.name[0]}</p>}
      </section>
    </div>
  );
}
