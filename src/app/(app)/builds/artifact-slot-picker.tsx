"use client";

import { useState } from "react";
import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { Modal } from "@/components/modal";
import type { OwnedArtifactOption } from "./filter-sort";

// Replaces a plain <select> -- a dropdown only has room for a set name and
// main stat, which isn't enough to tell two same-set pieces apart. This shows
// the full stat block (main stat + every substat) for each candidate, same as
// the owned-artifacts card, so you can actually pick the right physical piece.
export function ArtifactSlotPicker({
  slot,
  artifacts,
  value,
  onChange,
}: {
  slot: ArtifactSlot;
  artifacts: OwnedArtifactOption[];
  value: number | null;
  onChange: (ownedArtifactId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = artifacts.filter((a) => a.slot === slot);
  const selected = value !== null ? options.find((a) => a.ownedArtifactId === value) : undefined;
  const filtered = options.filter((a) => a.setName.toLowerCase().includes(search.trim().toLowerCase()));

  function select(ownedArtifactId: number | null) {
    onChange(ownedArtifactId);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          selected
            ? `${selected.setName} +${selected.level} (${selected.mainStatName})`
            : `Choose ${slot.toLowerCase()}`
        }
        className={`relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-white p-1 hover:opacity-90 ${
          selected ? rarityGradientClasses(selected.rarity) : "bg-foreground/10"
        }`}
      >
        {selected ? (
          <Image src={selected.iconUrl ?? ARTIFACT_SLOT_ICON_URL[slot]} alt="" width={104} height={104} />
        ) : (
          <>
            <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt="" fill className="object-contain p-1 opacity-30" />
            <svg
              viewBox="0 0 16 16"
              width={64}
              height={64}
              className="relative text-foreground [animation:blink_2.5s_ease-in-out_infinite]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M8 2v12M2 8h12" />
            </svg>
          </>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Choose ${slot.toLowerCase()}`}>
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            placeholder="Search by set name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <ul className="max-h-96 space-y-1 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => select(null)}
                className="flex w-full items-center gap-3 rounded p-2 text-left text-sm hover:bg-black/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-foreground/10 text-gray-400">
                  —
                </div>
                None
              </button>
            </li>
            {filtered.map((artifact) => (
              <li key={artifact.ownedArtifactId}>
                <button
                  type="button"
                  onClick={() => select(artifact.ownedArtifactId)}
                  className="flex w-full items-start gap-3 rounded p-2 text-left hover:bg-black/5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded p-1 ${rarityGradientClasses(artifact.rarity)}`}
                  >
                    <Image
                      src={artifact.iconUrl ?? ARTIFACT_SLOT_ICON_URL[artifact.slot]}
                      alt=""
                      width={32}
                      height={32}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {artifact.setName} <span className="text-gray-400">+{artifact.level}</span>
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {artifact.rarity}★ · Main: {artifact.mainStatName}
                    </p>
                    {artifact.substats.length > 0 && (
                      <div className="mt-0.5 grid grid-cols-2 gap-x-2 text-[11px] text-gray-500">
                        {artifact.substats.map((substat) => (
                          <p key={substat.statTypeName} className="truncate">
                            {substat.statTypeName} +
                            {substat.value.toFixed(substat.statTypeName.endsWith("%") ? 1 : 0)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No artifacts match this search.</p>}
          </ul>
        </div>
      </Modal>
    </>
  );
}
