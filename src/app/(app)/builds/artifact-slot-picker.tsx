"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { BlinkingPlusIcon } from "@/components/blinking-plus-icon";
import { Modal } from "@/components/modal";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { ARTIFACT_RARITIES } from "../artifacts/artifact-rules";
import { ArtifactCard } from "../artifacts/artifact-card";
import type { OwnedArtifactOption } from "./filter-sort";

type SortKey = "name" | "rarity" | "level";

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Sits alongside the real ArtifactCard entries in the picker's grid so "no
// piece" is just another option to click, not a separate row above the
// grid. Kept local rather than folded into ArtifactCard itself -- the owned-
// artifacts page always represents a real piece, so an "empty" variant would
// only ever be exercised here. Mirrors ArtifactCard's exact structure (icon
// area, then the stat block below it) rather than just its icon area, so
// this card comes out the same total height as its neighbors -- the stat
// block's content is invisible (nothing to show for "no piece") but still
// occupies the same space.
function NoneArtifactCard({ onSelect }: { onSelect: () => void }) {
  return (
    <li>
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect();
        }}
        className="@container relative w-full cursor-pointer overflow-hidden rounded-xl border-8 border-gray-600 bg-foreground/10 shadow hover:opacity-90"
      >
        <div className="aspect-[4/3] w-full" />
        <div aria-hidden="true" className="invisible bg-background px-2 py-1.5">
          <p className="-mx-2 mb-2.5 truncate bg-foreground/10 px-2 pb-1 pt-1.5 text-xs">MAIN STAT: placeholder</p>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide">Substats</p>
          <div className="min-h-[4.5rem] @[18rem]:min-h-[2.5rem]" />
        </div>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-400">
          None
        </span>
      </div>
    </li>
  );
}

// Replaces a plain <select> -- a dropdown only has room for a set name and
// main stat, which isn't enough to tell two same-set pieces apart. Mirrors
// WeaponSlotPicker's grid-of-cards pattern (search, rarity filter, sort, a
// link to the add page for a missing piece), reusing the same ArtifactCard
// the owned-artifacts page uses so a piece looks the same wherever it's
// shown -- with its full stat block still visible, since that's what
// actually distinguishes two same-set pieces from each other.
export function ArtifactSlotPicker({
  slot,
  artifacts,
  value,
  onChange,
  boxSizeClassName = "h-56 w-56",
  showStats = true,
  cardBorderClassName,
}: {
  slot: ArtifactSlot;
  artifacts: OwnedArtifactOption[];
  value: number | null;
  onChange: (ownedArtifactId: number | null) => void;
  // Overridable for a caller that wants this slot more compact than the
  // default 224x224 (e.g. BuildCatalog's own top row, once it needs to fit
  // all 5 of these alongside the weapon slot and name/save) -- only affects
  // this closed/empty slot, never the modal's own grid, which stays full
  // size for picking regardless. Keep this reasonably sized rather than
  // shrinking too far -- ArtifactCard's own stat block has a minimum
  // height that doesn't shrink with width, so going much narrower than
  // ~w-32 starts coming out tall and narrow instead of square (see the
  // "selected" card's own comment below) -- unless showStats is also off.
  boxSizeClassName?: string;
  // false drops the main stat/substat block below the icon on the selected
  // display, same plain-icon treatment WeaponCard already has -- e.g.
  // BuildCatalog's own compact slot, where that block (plus its own
  // minimum height) doesn't fit well at a much smaller box size. Default
  // true keeps the existing behavior (e.g. the owned-build edit modal),
  // where the stat block is what actually tells two same-set pieces apart.
  showStats?: boolean;
  // Forwarded to ArtifactCard's own borderClassName for the selected
  // display only -- e.g. BuildCatalog's own compact artifact slot, where
  // ArtifactCard's usual 8px border reads as too heavy at a much smaller
  // box size. Undefined keeps ArtifactCard's own default.
  cardBorderClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const options = artifacts.filter((a) => a.slot === slot);
  const selected = value !== null ? options.find((a) => a.ownedArtifactId === value) : undefined;

  const query = search.trim().toLowerCase();
  const direction = sortDirection === "desc" ? -1 : 1;
  const filtered = options
    .filter(
      (a) => a.setName.toLowerCase().includes(query) && (rarityFilter.size === 0 || rarityFilter.has(a.rarity))
    )
    .sort((a, b) => {
      if (sortKey === "rarity") return direction * (a.rarity - b.rarity) || a.setName.localeCompare(b.setName);
      if (sortKey === "level") return direction * (a.level - b.level) || a.setName.localeCompare(b.setName);
      return direction * a.setName.localeCompare(b.setName);
    });

  function select(ownedArtifactId: number | null) {
    onChange(ownedArtifactId);
    setOpen(false);
  }

  return (
    <>
      {selected ? (
        // boxSizeClassName's own h-* is a no-op here (ArtifactCard's own
        // aspect ratio drives its actual height), but see this component's
        // own prop comment on why going too narrow still comes out tall
        // and narrow regardless, from the stat block's own minimum height.
        <ul className={`${boxSizeClassName} shrink-0`}>
          <ArtifactCard
            setName={selected.setName}
            slot={slot}
            rarity={selected.rarity}
            level={showStats ? selected.level : undefined}
            mainStatName={showStats ? selected.mainStatName : undefined}
            iconUrl={selected.iconUrl}
            substats={showStats ? selected.substats : undefined}
            onSelect={() => setOpen(true)}
            showSetName={false}
            showSlotBadge={false}
            borderClassName={cardBorderClassName}
          />
        </ul>
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
              className="min-w-0 flex-1 rounded border bg-white px-3 py-2 text-sm text-black"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-[38px] rounded border bg-white px-2 text-sm text-black"
            >
              <option value="name">Sort: Name</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="level">Sort: Level</option>
            </select>
            <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
          </div>

          <RarityFilterRow
            rarities={ARTIFACT_RARITIES}
            rarityFilter={rarityFilter}
            onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
          />

          <p className="text-sm text-gray-500">
            Cannot find a piece? Add one on the{" "}
            <Link href="/artifacts/add" className="underline hover:text-foreground">
              Add artifact page
            </Link>
            .
          </p>

          <ul className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            <NoneArtifactCard onSelect={() => select(null)} />
            {filtered.map((artifact) => (
              <ArtifactCard
                key={artifact.ownedArtifactId}
                setName={artifact.setName}
                slot={slot}
                rarity={artifact.rarity}
                level={artifact.level}
                mainStatName={artifact.mainStatName}
                iconUrl={artifact.iconUrl}
                substats={artifact.substats}
                onSelect={() => select(artifact.ownedArtifactId)}
                showSetName={false}
                showSlotBadge={false}
              />
            ))}
          </ul>
          {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No artifacts match this search.</p>}
        </div>
      </Modal>
    </>
  );
}
