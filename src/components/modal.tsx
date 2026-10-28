"use client";

import { useEffect, useRef } from "react";

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
  hideCloseButton = false,
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
  // true hides the top-right X entirely -- for content (e.g. the owned-
  // builds create/edit forms) whose own top row already has a form-level
  // action button right where the X would otherwise sit, with no width to
  // spare for both. Closing still works via Escape or a backdrop click
  // either way; this only removes the one redundant affordance.
  hideCloseButton?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Whether the mousedown that started this click also landed directly on
  // the backdrop -- a click event's own target isn't necessarily where the
  // mousedown happened: dragging to select text inside the panel (e.g.
  // deleting a build's name) and releasing the mouse outside the modal
  // resolves the synthesized click's target to the nearest common
  // ancestor of the mousedown and mouseup targets, which is the backdrop
  // itself once the drag crosses out of the panel -- satisfying
  // `event.target === event.currentTarget` below even though the user
  // never actually clicked the backdrop. Requiring the mousedown to have
  // started there too is what tells a genuine backdrop click apart from
  // a drag that merely ended on it.
  const mouseDownOnBackdrop = useRef(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        mouseDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && mouseDownOnBackdrop.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-5 text-foreground shadow-lg ${fitContent ? "w-fit" : "w-full"} ${maxWidthClassName}`}
      >
        {!hideCloseButton && (
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
        )}
        {title && <div className={`mb-4 text-base font-semibold ${hideCloseButton ? "" : "pr-10"}`}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
