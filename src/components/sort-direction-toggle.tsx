"use client";

import type { SortDirection } from "@/lib/sort";

// Segmented up/down control; the active direction is highlighted rather than
// a single icon that flips, so the current state is visible at a glance.
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
        title="Ascending"
        className={`px-3 py-2 text-sm ${direction === "asc" ? "bg-blue-500 text-white" : "bg-white text-black"}`}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onChange("desc")}
        aria-pressed={direction === "desc"}
        title="Descending"
        className={`border-l px-3 py-2 text-sm ${
          direction === "desc" ? "bg-blue-500 text-white" : "bg-white text-black"
        }`}
      >
        ↓
      </button>
    </div>
  );
}
