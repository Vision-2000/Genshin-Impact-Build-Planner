"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Confirms an action (e.g. "added X") on a page that has no local list to
// show the result in -- the create flow lives on its own route, separate
// from wherever the created item actually gets displayed.
export function useToast() {
  const [message, setMessage] = useState<ReactNode | null>(null);
  const [visible, setVisible] = useState(false);
  const timeouts = useRef<{ hide?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> }>({});

  function showToast(content: ReactNode) {
    // Clear any in-flight hide/unmount timers from a previous toast so
    // rapid actions just reset the countdown instead of a stale timeout
    // cutting the new toast's animation short.
    clearTimeout(timeouts.current.hide);
    clearTimeout(timeouts.current.clear);

    setMessage(content);
    // Mount in the hidden state first, then flip to visible on the next
    // frame so the opacity/translate transition actually has something to
    // animate from, instead of just appearing already-visible.
    requestAnimationFrame(() => setVisible(true));

    timeouts.current.hide = setTimeout(() => {
      setVisible(false);
      timeouts.current.clear = setTimeout(() => setMessage(null), 300);
    }, 2000);
  }

  return { message, visible, showToast };
}

// left-48 matches the sidebar's own w-48, so this centers within the page
// content area rather than the full viewport (which would skew it off-center
// behind the sidebar).
export function Toast({ message, visible }: { message: ReactNode; visible: boolean }) {
  // Portal to document.body rather than rendering in place -- this is
  // only ever mounted alongside an open Modal on the artifact-add page
  // (every other call site closes its own modal, if any, before a toast
  // can appear), and that's exactly the combination that visibly shifted
  // the Modal's own fixed backdrop upward by a sliver the instant this
  // mounted: both are position:fixed, but this one previously rendered as
  // a descendant of <main>'s own scrollable, non-zero-scrollTop subtree
  // (see (app)/layout.tsx), which browsers can inconsistently use as the
  // fixed-positioning reference instead of the true viewport. Mounting
  // directly on body sidesteps that regardless of which ancestor's scroll
  // state happens to be at fault. No mount-check needed for the
  // document.body reference below despite this being SSR'd -- `message`
  // itself only ever becomes non-null from a client-side showToast() call
  // (never during the initial server render), so by the time this branch
  // runs at all, the component has already hydrated on the client.
  if (!message) return null;

  return createPortal(
    // pointer-events-none on the wrapper, re-enabled on just the pill --
    // the wrapper spans the full page-content width to center the pill in
    // it, but that invisible full-width strip sat in front of (z-50) and
    // blocked clicks on whatever page content shares that same vertical
    // band (e.g. the add-weapon page's own "Back to my weapons" link).
    <div className="pointer-events-none fixed left-48 right-0 top-4 z-50 flex justify-center">
      <div
        className={`pointer-events-auto rounded-full border-2 border-emerald-300 bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        {message}
      </div>
    </div>,
    document.body
  );
}
