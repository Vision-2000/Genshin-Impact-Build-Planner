"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { paginate } from "@/lib/paginate";
import { PaginationControls } from "../pagination-controls";
import {
  createBuild,
  updateBuildName,
  updateBuildWeapon,
  setBuildArtifact,
  deleteBuild,
  getBuildContainerNames,
} from "./actions";
import type { CreateBuildErrors } from "./schemas";
import {
  filterAndSortBuilds,
  type BuildItem,
  type BuildSortKey,
  type OwnedArtifactOption,
  type OwnedCharacterOption,
  type OwnedWeaponOption,
} from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const PAGE_SIZE = 10;

type SlotSelections = Partial<Record<ArtifactSlot, number>>;

function BuildNameInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
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
      className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm text-black"
    />
  );
}

function BuildCard({
  build,
  weaponType,
  weapons,
  artifacts,
  onUpdateName,
  onUpdateWeapon,
  onUpdateArtifact,
  onDelete,
}: {
  build: BuildItem;
  weaponType: string | undefined;
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  onUpdateName: (name: string) => void;
  onUpdateWeapon: (ownedWeaponId: number | null) => void;
  onUpdateArtifact: (slot: ArtifactSlot, ownedArtifactId: number | null) => void;
  onDelete: () => void;
}) {
  const matchingWeapons = weapons.filter((w) => w.weaponType === weaponType);

  return (
    <li className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-3">
        {build.characterIconUrl && <Image src={build.characterIconUrl} alt="" width={32} height={32} />}
        <span className="text-xs text-gray-500">{build.characterName}</span>
        <BuildNameInput value={build.name} onCommit={onUpdateName} />
        <button type="button" onClick={onDelete} className="text-xs text-red-600 underline">
          Delete
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">Weapon:</span>
        <select
          value={build.ownedWeaponId ?? ""}
          onChange={(event) => onUpdateWeapon(event.target.value ? Number(event.target.value) : null)}
          className="rounded border bg-white px-2 py-1 text-xs text-black"
        >
          <option value="">None</option>
          {matchingWeapons.map((weapon) => (
            <option key={weapon.ownedWeaponId} value={weapon.ownedWeaponId}>
              {weapon.name} (R{weapon.refinement})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SLOTS.map((slot) => {
          const current = build.artifacts.find((a) => a.slot === slot);
          const options = artifacts.filter((a) => a.slot === slot);
          return (
            <div key={slot} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-gray-500">{slot}:</span>
              <select
                value={current?.ownedArtifactId ?? ""}
                onChange={(event) => onUpdateArtifact(slot, event.target.value ? Number(event.target.value) : null)}
                className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-xs text-black"
              >
                <option value="">None</option>
                {options.map((option) => (
                  <option key={option.ownedArtifactId} value={option.ownedArtifactId}>
                    {option.setName} ({option.mainStatName})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </li>
  );
}

export function BuildManager({
  characters,
  weapons,
  artifacts,
  initialBuilds,
}: {
  characters: OwnedCharacterOption[];
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  initialBuilds: BuildItem[];
}) {
  const [builds, setBuilds] = useState(initialBuilds);
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<BuildSortKey>("name");
  const [page, setPage] = useState(1);

  const filtered = filterAndSortBuilds(builds, { search, sortKey });
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);

  const [createCharacterId, setCreateCharacterId] = useState<number | null>(characters[0]?.ownedCharacterId ?? null);
  const [createName, setCreateName] = useState("");
  const [createWeaponId, setCreateWeaponId] = useState<number | null>(null);
  const [createSlots, setCreateSlots] = useState<SlotSelections>({});
  const [createErrors, setCreateErrors] = useState<CreateBuildErrors>({});

  const createCharacter = characters.find((c) => c.ownedCharacterId === createCharacterId);
  const createWeaponOptions = weapons.filter((w) => w.weaponType === createCharacter?.weaponType);

  function handleUpdateName(buildId: number, name: string) {
    const previous = builds;
    setBuilds((prev) => prev.map((b) => (b.id === buildId ? { ...b, name } : b)));
    startTransition(() => {
      updateBuildName(buildId, name).catch(() => setBuilds(previous));
    });
  }

  function handleUpdateWeapon(build: BuildItem, ownedWeaponId: number | null) {
    const previous = builds;
    const weapon = ownedWeaponId ? weapons.find((w) => w.ownedWeaponId === ownedWeaponId) : undefined;
    setBuilds((prev) =>
      prev.map((b) =>
        b.id === build.id
          ? {
              ...b,
              ownedWeaponId,
              weaponName: weapon?.name ?? null,
              weaponIconUrl: weapon?.iconUrl ?? null,
              weaponRefinement: weapon?.refinement ?? null,
            }
          : b
      )
    );
    startTransition(() => {
      updateBuildWeapon(build.id, ownedWeaponId).catch(() => setBuilds(previous));
    });
  }

  function handleUpdateArtifact(build: BuildItem, slot: ArtifactSlot, ownedArtifactId: number | null) {
    const previous = builds;
    const option = ownedArtifactId ? artifacts.find((a) => a.ownedArtifactId === ownedArtifactId) : undefined;
    setBuilds((prev) =>
      prev.map((b) =>
        b.id === build.id
          ? {
              ...b,
              artifacts: b.artifacts.map((a) =>
                a.slot === slot
                  ? {
                      slot,
                      ownedArtifactId,
                      setName: option?.setName ?? null,
                      mainStatName: option?.mainStatName ?? null,
                      iconUrl: option?.iconUrl ?? null,
                    }
                  : a
              ),
            }
          : b
      )
    );
    startTransition(() => {
      setBuildArtifact(build.id, slot, ownedArtifactId).catch(() => setBuilds(previous));
    });
  }

  function handleDelete(buildId: number) {
    startTransition(async () => {
      const { teamNames, rosterNames } = await getBuildContainerNames(buildId);
      const containerLabels = [
        ...teamNames.map((name) => `team "${name}"`),
        ...rosterNames.map((name) => `roster "${name}"`),
      ];
      const message =
        containerLabels.length > 0
          ? `This build is used in: ${containerLabels.join(", ")}. Deleting it will remove it from ${
              containerLabels.length === 1 ? "that" : "those"
            } too. Delete anyway?`
          : "Delete this build? This can't be undone.";

      if (!window.confirm(message)) return;

      const previous = builds;
      setBuilds((prev) => prev.filter((b) => b.id !== buildId));
      deleteBuild(buildId).catch(() => setBuilds(previous));
    });
  }

  function handleCreateSubmit() {
    if (createCharacterId === null) {
      setCreateErrors({ ownedCharacterId: ["Pick a character."] });
      return;
    }

    const artifactEntries = SLOTS.map((slot) => ({ slot, ownedArtifactId: createSlots[slot] })).filter(
      (entry): entry is { slot: ArtifactSlot; ownedArtifactId: number } => entry.ownedArtifactId !== undefined
    );

    startTransition(async () => {
      const result = await createBuild({
        ownedCharacterId: createCharacterId,
        name: createName,
        ownedWeaponId: createWeaponId,
        artifacts: artifactEntries,
      });

      if ("errors" in result) {
        setCreateErrors(result.errors);
        return;
      }

      setBuilds((prev) => [...prev, result.build]);
      setCreateErrors({});
      setCreateName("");
      setCreateWeaponId(null);
      setCreateSlots({});
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your builds</h2>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by build or character name..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as BuildSortKey)}
            className="rounded border bg-white px-3 py-2 text-sm text-black"
          >
            <option value="name">Sort: Name</option>
            <option value="character">Sort: Character</option>
          </select>
        </div>

        <p className="text-sm text-gray-500">
          {filtered.length} build{filtered.length === 1 ? "" : "s"}
        </p>

        <ul className="space-y-2">
          {pageItems.map((build) => (
            <BuildCard
              key={build.id}
              build={build}
              weaponType={characters.find((c) => c.ownedCharacterId === build.ownedCharacterId)?.weaponType}
              weapons={weapons}
              artifacts={artifacts}
              onUpdateName={(name) => handleUpdateName(build.id, name)}
              onUpdateWeapon={(ownedWeaponId) => handleUpdateWeapon(build, ownedWeaponId)}
              onUpdateArtifact={(slot, ownedArtifactId) => handleUpdateArtifact(build, slot, ownedArtifactId)}
              onDelete={() => handleDelete(build.id)}
            />
          ))}
          {pageItems.length === 0 && <p className="text-sm text-gray-500">No builds match these filters.</p>}
        </ul>

        <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Create a build</h2>

        {characters.length === 0 ? (
          <p className="text-sm text-gray-500">Own a character on the Characters page before creating a build.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="text-xs">
                Character
                <select
                  value={createCharacterId ?? ""}
                  onChange={(event) => {
                    setCreateCharacterId(Number(event.target.value));
                    setCreateWeaponId(null);
                    setCreateSlots({});
                  }}
                  className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                >
                  {characters.map((character) => (
                    <option key={character.ownedCharacterId} value={character.ownedCharacterId}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs">
                Name
                <input
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="e.g. Main DPS"
                  className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                />
              </label>

              <label className="text-xs">
                Weapon
                <select
                  value={createWeaponId ?? ""}
                  onChange={(event) => setCreateWeaponId(event.target.value ? Number(event.target.value) : null)}
                  className="ml-1 rounded border bg-white px-2 py-1 text-xs text-black"
                >
                  <option value="">None</option>
                  {createWeaponOptions.map((weapon) => (
                    <option key={weapon.ownedWeaponId} value={weapon.ownedWeaponId}>
                      {weapon.name} (R{weapon.refinement})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {createErrors.ownedCharacterId && (
              <p className="text-xs text-red-600">{createErrors.ownedCharacterId[0]}</p>
            )}
            {createErrors.name && <p className="text-xs text-red-600">{createErrors.name[0]}</p>}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SLOTS.map((slot) => {
                const options = artifacts.filter((a) => a.slot === slot);
                return (
                  <label key={slot} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-gray-500">{slot}:</span>
                    <select
                      value={createSlots[slot] ?? ""}
                      onChange={(event) =>
                        setCreateSlots((prev) => ({
                          ...prev,
                          [slot]: event.target.value ? Number(event.target.value) : undefined,
                        }))
                      }
                      className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-xs text-black"
                    >
                      <option value="">None</option>
                      {options.map((option) => (
                        <option key={option.ownedArtifactId} value={option.ownedArtifactId}>
                          {option.setName} ({option.mainStatName})
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleCreateSubmit}
              className="rounded bg-black px-3 py-1 text-xs text-white"
            >
              Create build
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
