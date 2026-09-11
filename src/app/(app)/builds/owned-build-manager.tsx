"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArtifactSlot, WeaponType } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { paginate } from "@/lib/paginate";
import { useRefreshOnBackNavigation } from "@/lib/use-refresh-on-back-navigation";
import { useDialogs } from "@/components/dialog-provider";
import { Modal } from "@/components/modal";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { PaginationControls } from "../pagination-controls";
import { ELEMENT_ICON_URL } from "../characters/element-icons";
import { updateBuildName, updateBuildWeapon, setBuildArtifact, deleteBuild, getBuildContainerNames } from "./actions";
import { ArtifactSlotPicker } from "./artifact-slot-picker";
import { WeaponSlotPicker } from "./weapon-slot-picker";
import {
  filterAndSortBuilds,
  type BuildItem,
  type BuildSortKey,
  type OwnedArtifactOption,
  type OwnedWeaponOption,
} from "./filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const PAGE_SIZE = 60;

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 2.5l3 3L6 13l-3.5 1L4 10.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9.5h6.8L12 4" />
    </svg>
  );
}

// Display-only grid card, same treatment as the other pages: character
// portrait as the hero image, element badge, rarity-tinted border. Below it,
// a compact readout of the weapon and all 5 artifact slots so the whole
// loadout is visible without opening anything. Edit/delete are hover/focus
// revealed buttons, not a click on the card itself, since editing is rare
// next to just glancing at a build.
function BuildCard({
  build,
  isActive,
  onEdit,
  onDelete,
}: {
  build: BuildItem;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group relative">
      <div
        className={`w-full overflow-hidden rounded-xl border-8 shadow ${
          isActive ? "border-blue-500" : "border-gray-600"
        } ${rarityGradientClasses(build.characterRarity)}`}
      >
        <div className="relative aspect-[4/3] w-full">
          {build.characterIconUrl && (
            <Image
              src={build.characterIconUrl}
              alt=""
              fill
              sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
              className="object-cover"
            />
          )}

          <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
            <Image
              src={ELEMENT_ICON_URL[build.characterElement]}
              alt={build.characterElement}
              width={26}
              height={26}
            />
          </span>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
            <p className="truncate text-center text-sm font-semibold text-white">{build.name}</p>
            <p className="truncate text-center text-xs text-gray-300">{build.characterName}</p>
          </div>
        </div>

        <div className="space-y-1.5 bg-background px-2 py-1.5">
          <div className="flex items-center gap-2">
            {build.weaponIconUrl ? (
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded p-0.5 ${rarityGradientClasses(build.weaponRarity ?? 1)}`}
              >
                <Image src={build.weaponIconUrl} alt="" width={22} height={22} />
              </div>
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-foreground/10 text-xs text-gray-400">
                —
              </div>
            )}
            <p className="truncate text-xs text-foreground/80">
              {build.weaponName ? `${build.weaponName} R${build.weaponRefinement}` : "No weapon"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {build.artifacts.map((artifact) => (
              <div
                key={artifact.slot}
                title={artifact.setName ?? `${artifact.slot}: empty`}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  artifact.iconUrl ? "bg-black/70" : "bg-foreground/10"
                }`}
              >
                <Image
                  src={artifact.iconUrl ?? ARTIFACT_SLOT_ICON_URL[artifact.slot]}
                  alt={artifact.slot}
                  width={artifact.iconUrl ? 20 : 16}
                  height={artifact.iconUrl ? 20 : 16}
                  className={artifact.iconUrl ? "" : "opacity-40"}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`absolute right-1.5 top-1.5 z-20 flex gap-1 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
          isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${build.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-black"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${build.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-red-600"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function BuildEditor({
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
  weaponType: WeaponType;
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  onUpdateName: (name: string) => void;
  onUpdateWeapon: (ownedWeaponId: number | null) => void;
  onUpdateArtifact: (slot: ArtifactSlot, ownedArtifactId: number | null) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(build.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg p-1.5 ${rarityGradientClasses(build.characterRarity)}`}
        >
          {build.characterIconUrl && <Image src={build.characterIconUrl} alt="" width={56} height={56} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{build.characterName}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Name:
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== build.name) onUpdateName(trimmed);
            else setName(build.name);
          }}
          className="h-8 min-w-0 flex-1 rounded border bg-white px-2 text-sm text-black"
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium">Weapon</p>
        <div className="flex flex-wrap gap-2">
          <WeaponSlotPicker
            weaponType={weaponType}
            weapons={weapons}
            value={build.ownedWeaponId}
            onChange={onUpdateWeapon}
          />
        </div>
        <p className="text-sm font-medium">Artifacts</p>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((slot) => {
            const current = build.artifacts.find((a) => a.slot === slot);
            return (
              <ArtifactSlotPicker
                key={slot}
                slot={slot}
                artifacts={artifacts}
                value={current?.ownedArtifactId ?? null}
                onChange={(ownedArtifactId) => onUpdateArtifact(slot, ownedArtifactId)}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t pt-3">
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white"
        >
          Delete build
        </button>
      </div>
    </div>
  );
}

export function OwnedBuildManager({
  weapons,
  artifacts,
  initialBuilds,
}: {
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
  initialBuilds: BuildItem[];
}) {
  useRefreshOnBackNavigation();
  const [builds, setBuilds] = useState(initialBuilds);
  // useState(initialBuilds) only ever consults that argument on the very
  // first mount -- a later re-render with a fresh prop (e.g. from
  // router.refresh() after a back/forward bfcache restore) is otherwise
  // silently ignored, leaving this stuck on stale data even once the
  // server-fetched prop itself is correct again. Per React's own guidance,
  // this belongs during render (comparing against a mirrored "previous
  // prop" value), not in an effect -- an effect would apply the fresh data
  // one render late, visibly flashing the stale version first.
  const [prevInitialBuilds, setPrevInitialBuilds] = useState(initialBuilds);
  if (initialBuilds !== prevInitialBuilds) {
    setPrevInitialBuilds(initialBuilds);
    setBuilds(initialBuilds);
  }
  const [, startTransition] = useTransition();
  const { confirm } = useDialogs();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<BuildSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const filtered = filterAndSortBuilds(builds, { search, sortKey, sortDirection });
  const { pageItems, pageCount, currentPage } = paginate(filtered, page, PAGE_SIZE);
  const editingBuild = editingId === null ? null : (builds.find((b) => b.id === editingId) ?? null);
  const activeId = editingId ?? pendingDeleteId;

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
              weaponRarity: weapon?.rarity ?? null,
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

  async function handleDelete(buildId: number) {
    setPendingDeleteId(buildId);
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

    const confirmed = await confirm(message, { title: "Delete build", confirmLabel: "Delete", danger: true });
    setPendingDeleteId(null);
    if (!confirmed) return;

    setEditingId((current) => (current === buildId ? null : current));
    startTransition(() => {
      const previous = builds;
      setBuilds((prev) => prev.filter((b) => b.id !== buildId));
      deleteBuild(buildId).catch(() => setBuilds(previous));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
          className="h-[38px] rounded border bg-white px-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="character">Sort: Character</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
      </div>

      <p className="text-sm text-gray-500">
        {filtered.length} build{filtered.length === 1 ? "" : "s"}
      </p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pageItems.map((build) => (
          <BuildCard
            key={build.id}
            build={build}
            isActive={build.id === activeId}
            onEdit={() => setEditingId(build.id)}
            onDelete={() => handleDelete(build.id)}
          />
        ))}
        {pageItems.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">No builds match these filters.</p>
        )}
      </ul>

      <PaginationControls currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} />

      <Modal open={editingBuild !== null} onClose={() => setEditingId(null)}>
        {editingBuild && (
          <BuildEditor
            key={editingBuild.id}
            build={editingBuild}
            weaponType={editingBuild.characterWeaponType}
            weapons={weapons}
            artifacts={artifacts}
            onUpdateName={(name) => handleUpdateName(editingBuild.id, name)}
            onUpdateWeapon={(ownedWeaponId) => handleUpdateWeapon(editingBuild, ownedWeaponId)}
            onUpdateArtifact={(slot, ownedArtifactId) => handleUpdateArtifact(editingBuild, slot, ownedArtifactId)}
            onDelete={() => handleDelete(editingBuild.id)}
          />
        )}
      </Modal>
    </div>
  );
}
