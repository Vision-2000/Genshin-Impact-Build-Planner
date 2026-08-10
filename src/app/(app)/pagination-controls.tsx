"use client";

type PaginationControlsProps = {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ currentPage, pageCount, onPageChange }: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-sm text-gray-500">
        Page {currentPage} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        disabled={currentPage === pageCount}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
