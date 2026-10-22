"use client";

type PaginationControlsProps = {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

// Nothing to show at all once there's only one page -- no Previous/Next (a
// disabled button that can never do anything isn't worth showing), and no
// "Page 1 of 1" either, since that's the same as saying nothing. Shared by
// Builds/Artifacts/Teams/Rosters/Lineups, so this is never rendered with
// pageCount < 1 regardless of caller.
export function PaginationControls({ currentPage, pageCount, onPageChange }: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < pageCount;

  return (
    <div className="flex items-center justify-between">
      {hasPrevious ? (
        <button type="button" onClick={() => onPageChange(currentPage - 1)} className="rounded border px-3 py-1 text-sm">
          Previous
        </button>
      ) : (
        <span />
      )}
      <span className="text-sm text-gray-500">
        Page {currentPage} of {pageCount}
      </span>
      {hasNext ? (
        <button type="button" onClick={() => onPageChange(currentPage + 1)} className="rounded border px-3 py-1 text-sm">
          Next
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
