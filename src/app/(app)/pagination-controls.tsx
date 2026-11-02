"use client";

type PaginationControlsProps = {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

// Previous/Next as one grouped unit -- shared by PaginationControls' own
// bottom-of-content placement and each page's own top-of-content row
// (next to its "N items" count), so a page's top and bottom nav always
// stay in sync without duplicating this markup. Both buttons are always
// rendered together once there's more than one page, disabled (not
// hidden) when there's nothing in that direction -- unlike hiding one
// side outright, this keeps the pair's own position fixed rather than
// collapsing to a single off-center button on the first/last page.
export function PaginationNavButtons({ currentPage, pageCount, onPageChange }: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < pageCount;

  return (
    <div className="flex items-center gap-2">
      {/* pb-0.5 pt-1.5 (not symmetric py-1) -- same Arial line-height fix
          as this app's other small bordered text buttons (e.g. the
          search boxes' own pb-0.5/pt-1.5): items-center alone left the
          text reading visibly above true center. hover:bg-black/5
          dark:hover:bg-white/10 -- same hover treatment every other
          bordered button in this app gets (e.g. help-button.tsx); these
          two never had ANY hover class before this component existed. */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevious}
        className="rounded border px-3 pb-0.5 pt-1.5 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext}
        className="rounded border px-3 pb-0.5 pt-1.5 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
      >
        Next
      </button>
    </div>
  );
}

// Nothing to show at all once there's only one page -- no Previous/Next (a
// disabled button that can never do anything isn't worth showing), and no
// "Page 1 of 1" either, since that's the same as saying nothing. Shared by
// Builds/Artifacts/Teams/Rosters/Lineups, so this is never rendered with
// pageCount < 1 regardless of caller.
export function PaginationControls({ currentPage, pageCount, onPageChange }: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">
        Page {currentPage} of {pageCount}
      </span>
      <PaginationNavButtons currentPage={currentPage} pageCount={pageCount} onPageChange={onPageChange} />
    </div>
  );
}
