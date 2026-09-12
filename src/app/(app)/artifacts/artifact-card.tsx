"use client";

import Image from "next/image";
import { ArtifactSlot } from "@/generated/prisma/enums";
import { ARTIFACT_SLOT_ICON_URL } from "@/lib/artifact-slot-icons";
import { rarityGradientClasses } from "@/lib/rarity-colors";

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

// Shared visual card for the owned-artifacts list and the build creation/
// editing artifact picker -- same rarity-gradient-square treatment as
// Characters/Weapons, but with a plain-text block below the icon for the
// main stat and substats, since that's what actually tells two same-set
// pieces apart (a dropdown or a bare icon can't). `onSelect` is the picker
// case -- the whole card becomes the click target, editing/deleting don't
// apply there, and the set name/slot badge (already implied by which
// picker slot you opened) are hidden to keep the grid dense.
export function ArtifactCard({
  setName,
  slot,
  rarity,
  level,
  mainStatName,
  iconUrl,
  substats,
  isActive = false,
  onEdit,
  onDelete,
  onSelect,
  showSetName = true,
  showSlotBadge = true,
}: {
  setName: string;
  slot: ArtifactSlot;
  rarity: number;
  level: number;
  mainStatName: string;
  iconUrl: string | null;
  substats: { statTypeName: string; value: number }[];
  // The card whose edit modal / delete confirm is currently open. Its action
  // buttons stay put and it keeps a highlighted border, so once the mouse
  // leaves for the dialog it's still obvious which piece is being operated on.
  isActive?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
  showSetName?: boolean;
  showSlotBadge?: boolean;
}) {
  return (
    <li className="group relative">
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        title={onSelect ? setName : undefined}
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect();
              }
            : undefined
        }
        className={`@container w-full overflow-hidden rounded-xl border-8 shadow ${
          onSelect ? "cursor-pointer hover:opacity-90" : ""
        } ${isActive ? "border-blue-500" : "border-gray-600"} ${rarityGradientClasses(rarity)}`}
      >
        <div className="relative aspect-[4/3] w-full">
          {iconUrl && (
            <Image
              src={iconUrl}
              alt={setName}
              fill
              sizes="(min-width: 1280px) 220px, (min-width: 1024px) 200px, (min-width: 640px) 180px, 40vw"
              className="object-contain p-4"
            />
          )}

          {showSlotBadge && (
            <span className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 p-1.5 shadow">
              <Image src={ARTIFACT_SLOT_ICON_URL[slot]} alt={slot} width={26} height={26} />
            </span>
          )}

          <span
            className={`absolute right-2 top-2 flex h-8 items-center justify-center rounded-md bg-black/70 px-2 shadow transition-transform duration-200 group-hover:translate-y-6 group-focus-within:translate-y-6 ${
              isActive ? "translate-y-6" : ""
            }`}
          >
            <span className="mt-0.5 text-sm font-semibold leading-none text-white">+{level}</span>
          </span>

          {showSetName && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8">
              <p className="truncate text-center text-sm font-semibold text-white">{setName}</p>
            </div>
          )}
        </div>

        <div className="bg-background px-2 py-1.5">
          <p className="-mx-2 mb-2.5 truncate bg-foreground/10 px-2 pb-1 pt-1.5 text-xs text-foreground">
            <span className="text-gray-400">MAIN STAT:</span> <span className="font-semibold">{mainStatName}</span>
          </p>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400">Substats</p>
          <div className="grid min-h-[4.5rem] grid-cols-1 gap-x-2 gap-y-1 @[18rem]:min-h-[2.5rem] @[18rem]:grid-cols-2">
            {substats.map((substat) => (
              <p key={substat.statTypeName} className="truncate text-[11px] leading-tight text-foreground/75">
                {substat.statTypeName} +{substat.value.toFixed(substat.statTypeName.endsWith("%") ? 1 : 0)}
              </p>
            ))}
          </div>
        </div>
      </div>

      {(onEdit || onDelete) && (
        <div
          className={`absolute right-1.5 top-1.5 z-20 flex gap-1 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
            isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${setName}`}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-black"
            >
              <PencilIcon />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${setName}`}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-red-600"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
