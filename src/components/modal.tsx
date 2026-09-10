"use client";

import { useEffect } from "react";

// Presentational modal: a plain conditionally-rendered overlay, same approach
// as DialogProvider (native <dialog>.showModal() proved unreliable). The
// parent owns the open state and supplies the content. Sits at z-40 -- below
// DialogProvider's z-50 -- so a confirm() triggered from inside the modal
// (e.g. a delete confirmation) still stacks on top.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border bg-background p-5 text-foreground shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:bg-black/5 hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        {title && <div className="mb-4 pr-10 text-base font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}
