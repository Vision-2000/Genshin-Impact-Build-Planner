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
  maxWidthClassName = "max-w-md",
  fitContent = false,
  closeButtonClassName = "text-gray-500 hover:bg-black/5 hover:text-foreground",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  // Overridable for content that needs more room than a typical form, e.g. a
  // picker showing a grid of cards instead of a simple list.
  maxWidthClassName?: string;
  // Default (false): the panel always renders at the full width
  // maxWidthClassName allows, regardless of how much the content actually
  // needs -- fine, even wanted, for a grid of cards meant to fill that
  // space. true: the panel shrinks to its content's own natural width
  // (maxWidthClassName becomes a ceiling, not a floor) -- for content
  // whose width varies a lot (e.g. per-character), where w-full would
  // leave a visible, inconsistent gap next to a narrower render. Only use
  // this with content that doesn't itself rely on a 1fr/flex-1-style
  // "fill whatever's given" layout -- those have no definite width to
  // size against once the panel itself stops providing one.
  fitContent?: boolean;
  // The default gray reads fine against the usual white/bg-background
  // panel, but is nearly invisible over the dark element/rarity-tinted
  // panels the character/weapon progression editors render as their own
  // content (see owned-character-manager.tsx, weapon-progression-form.tsx)
  // -- those pass a white-based override instead.
  closeButtonClassName?: string;
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
        className={`relative max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-5 text-foreground shadow-lg ${fitContent ? "w-fit" : "w-full"} ${maxWidthClassName}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded ${closeButtonClassName}`}
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
