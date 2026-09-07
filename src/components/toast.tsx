"use client";

import { useRef, useState, type ReactNode } from "react";

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
  if (!message) return null;

  return (
    <div className="fixed left-48 right-0 top-4 z-50 flex justify-center">
      <div
        className={`rounded-full border-2 border-emerald-300 bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
