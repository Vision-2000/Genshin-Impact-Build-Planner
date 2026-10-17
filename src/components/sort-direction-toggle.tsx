"use client";

import type { SortDirection } from "@/lib/sort";

// Segmented up/down control; the active direction is highlighted rather than
// a single icon that flips, so the current state is visible at a glance.
// Labeled Forward/Reverse rather than Ascending/Descending -- "asc" doesn't
// literally mean ascending for every sortKey a caller might use it with
// (e.g. Artifacts' own "release" sortKey flips which direction "asc" sorts
// in, see filterArtifactSetCatalog), so a tense-neutral label that just
// means "the toggle's two states" fits every caller instead of being
// technically wrong for some of them.
export function SortDirectionToggle({
  direction,
  onChange,
}: {
  direction: SortDirection;
  onChange: (direction: SortDirection) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border">
      <button
        type="button"
        onClick={() => onChange("asc")}
        aria-pressed={direction === "asc"}
        title="Forward"
        className={`px-3 py-2 text-sm ${direction === "asc" ? "bg-blue-500 text-white" : "bg-white text-black"}`}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onChange("desc")}
        aria-pressed={direction === "desc"}
        title="Reverse"
        className={`border-l px-3 py-2 text-sm ${
          direction === "desc" ? "bg-blue-500 text-white" : "bg-white text-black"
        }`}
      >
        ↓
      </button>
    </div>
  );
}
