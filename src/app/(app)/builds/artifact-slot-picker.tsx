"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { formatStatValue } from "@/lib/stat-format";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import {
  ARTIFACT_RARITIES,
  MAIN_STAT_NAMES,
  SORTABLE_STAT_NAMES,
  SUBSTAT_TYPE_NAMES,
  computeArtifactMainStatValue,
  type SortableStatName,
  type SubstatTypeName,
} from "../artifacts/artifact-rules";
import { ArtifactCard } from "../artifacts/artifact-card";
import type { OwnedArtifactOption } from "./filter-sort";

// Same sort keys the owned-artifacts page itself offers (see its own
// OwnedSortKey) -- "obtained" needs OwnedArtifactOption.createdAt, added
// alongside the others for exactly this kind of owned-page parity.
type SortKey = "name" | "rarity" | "level" | "obtained" | SortableStatName;

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Mirrors artifact-rules.ts's own private substatValue/sortableStatValue --
// a piece's TOTAL value for a given stat, main stat included, not just
// whatever (if anything) also rolled as a substat (see that file's own
// comment on why). Kept local rather than imported since those helpers
// aren't exported -- OwnedArtifactOption's shape is close enough to
// OwnedArtifactItem's (mainStatName/rarity/level/substats) that
// duplicating this small a function reads clearer than exporting a
// owned-page-specific helper for one other call site.
function substatValue(artifact: OwnedArtifactOption, statName: string): number | null {
  const substat = artifact.substats.find((s) => s.statTypeName === statName);
  return substat ? substat.value : null;
}

function sortableStatValue(artifact: OwnedArtifactOption, statName: SortableStatName): number | null {
  const substat = substatValue(artifact, statName);
  const mainStat =
    artifact.mainStatName === statName
      ? computeArtifactMainStatValue(artifact.mainStatName, artifact.rarity, artifact.level)
      : null;

  if (substat === null && mainStat === null) return null;
  return (substat ?? 0) + (mainStat ?? 0);
}

// Same convention as the owned-artifacts page's own tiebreakByAdded:
// newest first, fixed regardless of the primary sort's own direction
// toggle, since two owned pieces can never be created at the exact same
// moment.
function tiebreakByAdded(a: OwnedArtifactOption, b: OwnedArtifactOption): number {
  return b.createdAt - a.createdAt;
}

// The exact hover detail the owned-artifacts page's own ArtifactCard shows
// (see its buildTooltipContent) -- set name/level header, main stat, then
// every substat. Exported for BuildViewer (build-viewer.tsx), which reuses
// this exact same tooltip content for its own read-only artifact cards.
export function buildTooltipContent(artifact: OwnedArtifactOption) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <p className="text-base font-semibold text-yellow-100">{artifact.setName}</p>
        <p className="text-base font-semibold text-gray-400">+{artifact.level}</p>
      </div>
      <p className="mt-1 text-base font-semibold text-yellow-100">
        Main Stat: {artifact.mainStatName} +
        {formatStatValue(
          artifact.mainStatName,
          computeArtifactMainStatValue(artifact.mainStatName, artifact.rarity, artifact.level)
        )}
      </p>
      {artifact.substats.length > 0 && (
        <>
          <hr className="mt-2 border-gray-700" />
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {artifact.substats.map((substat) => (
              <p key={substat.statTypeName} className="text-gray-300">
                {substat.statTypeName} +{formatStatValue(substat.statTypeName, substat.value)}
              </p>
            ))}
          </div>
        </>
      )}
      <hr className="mt-2 border-gray-700" />
      <p className="mt-2 text-gray-300">
        <span className="font-semibold text-yellow-100">2pc: </span>
        {artifact.twoPieceEffect}
      </p>
      {artifact.fourPieceEffect && (
        <p className="mt-2 text-gray-300">
          <span className="font-semibold text-yellow-100">4pc: </span>
          {artifact.fourPieceEffect}
        </p>
      )}
    </>
  );
}

// Sits alongside the real ArtifactCard entries in the picker's grid so "no
// piece" is just another option to click, not a separate row above the
// grid. Kept local rather than folded into ArtifactCard itself -- the owned-
// artifacts page always represents a real piece, so an "empty" variant would
// only ever be exercised here. Plain icon-only square, same as
// NoneWeaponCard -- the modal grid's own cards are icon-only now too (hover
// for detail), not the always-visible stat block this used to need to match.
function NoneArtifactCard({ onSelect, selected = false }: { onSelect: () => void; selected?: boolean }) {
  return (
    <li>
      {/* border border-white -- matches the real ArtifactCard entries
          in this same grid now, for consistency, not because this
          card's own light bg-foreground/10 fill has the same
          blends-into-black problem those have. Swapped for blue, same
          width, when this slot currently has no piece equipped (the
          whole point of `selected` existing at all). */}
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect();
        }}
        className={`flex aspect-square w-full cursor-pointer items-center justify-center rounded-xl border bg-foreground/10 shadow hover:opacity-90 ${
          selected ? "border-blue-500" : "border-white"
        }`}
      >
        <span className="text-lg font-semibold text-gray-400">None</span>
      </div>
    </li>
  );
}

// Replaces a plain <select> -- a dropdown only has room for a set name and
// main stat, which isn't enough to tell two same-set pieces apart. Mirrors
// WeaponSlotPicker's grid-of-cards pattern (search, rarity/main-stat/
// substat filters, sort, a link to the add page for a missing piece),
// reusing the same ArtifactCard the owned-artifacts page uses so a piece
// looks the same wherever it's shown. The modal's own grid cards are
// icon-only with hover detail (tooltipContent, see buildTooltipContent
// above), same as the owned-artifacts page's current look -- telling two
// same-set pieces apart now means hovering each in turn, a deliberate
// tradeoff for full consistency with CharacterSlotPicker/WeaponSlotPicker's
// own modal grids (this used to keep the full stat block always visible
// specifically to avoid that tradeoff; CLAUDE.md still describes that
// older reasoning and is now stale on this point).
export function ArtifactSlotPicker({
  slot,
  artifacts,
  value,
  onChange,
  disabled = false,
  autoOpen,
  onOpenChange,
  boxSizeClassName = "h-56 w-56",
  cardBorderClassName,
}: {
  slot: ArtifactSlot;
  artifacts: OwnedArtifactOption[];
  value: number | null;
  onChange: (ownedArtifactId: number | null) => void;
  // BuildCatalog's own "no character chosen yet" state only -- mirrors
  // WeaponSlotPicker's weaponType-null gating (same reasoning: nothing
  // meaningful to pick yet), except artifacts have no narrowing value of
  // their own to double as that signal, so this is a plain explicit flag
  // instead. Always false (the default) for the owned-build edit modal's
  // own call site, where the character is locked and never null.
  disabled?: boolean;
  // Same as WeaponSlotPicker/CharacterSlotPicker's own autoOpen/
  // onOpenChange -- lets BuildCatalog's sessionStorage draft reopen this
  // picker after a remount (e.g. following this picker's own "add one on
  // the Add artifact page" link and coming back), and stay informed when
  // it opens/closes normally so that persisted state doesn't go stale.
  // Both optional -- callers that don't care about surviving navigation
  // (e.g. the owned-build edit modal) can ignore them entirely.
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Overridable for a caller that wants this slot more compact than the
  // default 224x224 (e.g. BuildCatalog's own top row, once it needs to fit
  // all 5 of these alongside the weapon slot and name/save) -- only affects
  // this closed/empty slot, never the modal's own grid, which stays full
  // size for picking regardless. Safe to shrink this as far as needed --
  // the selected display is always a plain aspect-square icon with a
  // hover tooltip for stat detail (see buildTooltipContent below), not
  // ArtifactCard's own always-visible stat block, which is what used to
  // set a practical lower bound here.
  boxSizeClassName?: string;
  // Forwarded to ArtifactCard's own borderClassName for the selected
  // display only -- e.g. BuildCatalog's own compact artifact slot, where
  // ArtifactCard's usual 8px border reads as too heavy at a much smaller
  // box size. Undefined keeps ArtifactCard's own default.
  cardBorderClassName?: string;
}) {
  const [open, setOpenState] = useState(false);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [substatFilter, setSubstatFilter] = useState<Set<SubstatTypeName>>(new Set());
  const [mainStatFilter, setMainStatFilter] = useState("");
  // "obtained" (not "name") -- matches the owned-artifacts page's own
  // default exactly, not just offering the same option.
  const [sortKey, setSortKey] = useState<SortKey>("obtained");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  // Fires when a caller's restored draft flips autoOpen to true after this
  // component has already mounted closed (the parent's own restore effect
  // runs post-hydration too, so this can't just be an initial state value)
  // -- same pattern and same reasoning as WeaponSlotPicker/
  // CharacterSlotPicker's own identical effect. Deliberate exception to
  // react-hooks/set-state-in-effect -- this is exactly the "synchronize
  // with a value owned by an external system" case (the caller's own
  // persisted draft), not derived-state busywork.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const options = artifacts.filter((a) => a.slot === slot);
  const selected = value !== null ? options.find((a) => a.ownedArtifactId === value) : undefined;

  const query = search.trim().toLowerCase();
  const direction = sortDirection === "desc" ? -1 : 1;
  const filtered = options
    .filter(
      (a) =>
        a.setName.toLowerCase().includes(query) &&
        (rarityFilter.size === 0 || rarityFilter.has(a.rarity)) &&
        (!mainStatFilter || a.mainStatName === mainStatFilter) &&
        [...substatFilter].every((statName) => substatValue(a, statName) !== null)
    )
    .sort((a, b) => {
      // Signs match the owned-artifacts page's own comparator exactly
      // (filterAndSortOwnedArtifacts), not just offering the same sort
      // keys -- rarity/level/obtained/every sortable stat all flip the
      // shared direction multiplier (forward = highest/newest first),
      // same tiebreakByAdded convention too.
      if (sortKey === "rarity") return -direction * (a.rarity - b.rarity) || tiebreakByAdded(a, b);
      if (sortKey === "level") return -direction * (a.level - b.level) || tiebreakByAdded(a, b);
      if (sortKey === "obtained") return -direction * (a.createdAt - b.createdAt);
      if ((SORTABLE_STAT_NAMES as readonly string[]).includes(sortKey)) {
        const aValue = sortableStatValue(a, sortKey as SortableStatName) ?? -Infinity;
        const bValue = sortableStatValue(b, sortKey as SortableStatName) ?? -Infinity;
        return -direction * (aValue - bValue) || tiebreakByAdded(a, b);
      }
      return direction * a.setName.localeCompare(b.setName) || tiebreakByAdded(a, b);
    });

  function select(ownedArtifactId: number | null) {
    onChange(ownedArtifactId);
    setOpen(false);
  }

  return (
    <>
      {selected ? (
        // Plain aspect-square icon with the main-stat-name text line (same
        // bottom-overlay position WeaponCard's own secondaryStatName
        // uses), and the same hover tooltip the modal grid's own cards use
        // for substat detail (buildTooltipContent: set name, level, main
        // stat, every substat) -- no level badge on the face itself, this
        // box renders too small now (see BuildCatalog/BuildEditor's own
        // SLOT_SIZE_CLASS) for it to add anything the tooltip doesn't
        // already say.
        <ul className={`${boxSizeClassName} shrink-0`}>
          <ArtifactCard
            setName={selected.setName}
            slot={slot}
            rarity={selected.rarity}
            mainStatName={selected.mainStatName}
            iconUrl={selected.iconUrl}
            tooltipContent={buildTooltipContent(selected)}
            onSelect={() => setOpen(true)}
            showSetName={false}
            showSlotBadge={false}
            borderClassName={cardBorderClassName}
          />
        </ul>
      ) : disabled ? (
        // Same dashed/muted/cursor-not-allowed treatment as
        // WeaponSlotPicker's own weaponType-null disabled state -- not a
        // <button> there either (no click handler, no keyboard focus), a
        // disabled native control still needs explicit styling to read as
        // inert. Unlike that one, this keeps the slot's own icon visible
        // (just dimmed along with the rest of the box, no separate
        // opacity-30 of its own) rather than an empty box -- losing which
        // slot is which (flower/feather/sands/goblet/circlet) reads as a
        // bigger loss here than it would for a single weapon slot.
        <div
          title="Pick a character first"
          aria-disabled="true"
          className={`relative flex ${boxSizeClassName} shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-500 bg-foreground/5 opacity-40`}
        >
          <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt="" fill className="object-contain p-1" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Choose artifact"
          className={`relative flex ${boxSizeClassName} shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-foreground/10 p-1 hover:opacity-90`}
        >
          <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt="" fill className="object-contain p-1 opacity-30" />
          <BlinkingPlusIcon />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Choose artifact" maxWidthClassName="max-w-4xl">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Search by set name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded border bg-white px-3 py-2 text-sm text-black"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              {/* Same order as the owned-artifacts page's own dropdown --
                  "Added" first, matching its own default sortKey, so the
                  selected option sits at the top of the opened list
                  instead of the bottom. */}
              <option value="obtained">Sort: Added</option>
              <option value="name">Sort: Name</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="level">Sort: Level</option>
              {SORTABLE_STAT_NAMES.map((name) => (
                <option key={name} value={name}>
                  Sort: {name}
                </option>
              ))}
            </select>
            <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
            <select
              value={mainStatFilter}
              onChange={(event) => setMainStatFilter(event.target.value)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="">Main stat: Any</option>
              {MAIN_STAT_NAMES.map((name) => (
                <option key={name} value={name}>
                  Main stat: {name}
                </option>
              ))}
            </select>
          </div>

          <RarityFilterRow
            rarities={ARTIFACT_RARITIES}
            rarityFilter={rarityFilter}
            onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
          />

          <div className="flex flex-wrap gap-2">
            {SUBSTAT_TYPE_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSubstatFilter((prev) => toggleInSet(prev, name))}
                className={`rounded-full border px-3 py-1 text-xs ${
                  substatFilter.has(name) ? "bg-foreground text-background" : ""
                }`}
              >
                Substat: {name}
              </button>
            ))}
          </div>

          <p className="text-sm text-gray-300">
            Cannot find a piece? Add one on the{" "}
            <Link href="/artifacts/add" className="underline hover:text-foreground">
              Add artifact page
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto [scrollbar-gutter:stable] sm:grid-cols-4 md:grid-cols-5">
            <NoneArtifactCard onSelect={() => select(null)} selected={value === null} />
            {filtered.map((artifact) => (
              <ArtifactCard
                key={artifact.ownedArtifactId}
                setName={artifact.setName}
                slot={slot}
                rarity={artifact.rarity}
                level={artifact.level}
                mainStatName={artifact.mainStatName}
                iconUrl={artifact.iconUrl}
                tooltipContent={buildTooltipContent(artifact)}
                onSelect={() => select(artifact.ownedArtifactId)}
                showSetName={false}
                showSlotBadge={false}
                // border border-white -- same thin-border fix as the
                // compact slot card (marks where the card ends against
                // its own near-black bottom gradient, which otherwise
                // blends into this modal's own dark background). Swapped
                // for blue, same width, when this is the currently
                // equipped piece.
                borderClassName={
                  artifact.ownedArtifactId === value ? "border border-blue-500" : "border border-white"
                }
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-300">No artifacts match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
