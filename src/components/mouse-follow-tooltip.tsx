"use client";

import { useRef, useState, type ReactNode } from "react";

// Wraps an icon/element so hovering it shows a tooltip that follows the
// cursor, rather than a fixed-position one -- used for constellation and
// talent icons on the character progression editor, where the icons sit in
// a small cluster and a fixed tooltip position would frequently overlap a
// neighboring icon.
export function MouseFollowTooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative inline-block"
      onMouseMove={(event) => setPos({ x: event.clientX, y: event.clientY })}
      onMouseLeave={() => setPos(null)}
      onWheel={(event) => {
        // The tooltip is deliberately offset from the cursor (so it doesn't
        // sit under the pointer, obscuring itself), which makes it an
        // awkward, easy-to-lose target to physically move the mouse onto
        // just to scroll a long description. Scrolling it here instead,
        // while the cursor stays right where it already is (on the
        // trigger), sidesteps that entirely -- same reason a native
        // <select>'s dropdown scrolls under the pointer without needing to
        // be "entered" first.
        if (!tooltipRef.current) return;
        event.preventDefault();
        tooltipRef.current.scrollTop += event.deltaY;
      }}
    >
      {children}
      {pos && (
        <div
          ref={tooltipRef}
          className="pointer-events-none fixed z-50 w-80 overflow-y-auto rounded-lg border border-gray-700 bg-black p-3.5 text-sm text-white shadow-lg"
          style={{ left: pos.x + 16, top: pos.y + 16, maxHeight: `calc(100vh - ${pos.y + 16}px - 16px)` }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
