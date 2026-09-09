"use client";

import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";

const SLOTS = Object.values(ArtifactSlot);

// Same round icon-badge treatment as Weapons' WeaponTypeFilterRow.
export function ArtifactSlotFilterRow({
  slotFilter,
  onToggle,
}: {
  slotFilter: ReadonlySet<ArtifactSlot>;
  onToggle: (slot: ArtifactSlot) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onToggle(slot)}
          aria-pressed={slotFilter.has(slot)}
          title={slot}
          className={`h-10 w-10 rounded-full ring-2 ${slotFilter.has(slot) ? "ring-blue-500" : "ring-foreground"}`}
        >
          <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt={slot} width={40} height={40} className="rounded-full" />
        </button>
      ))}
    </div>
  );
}
