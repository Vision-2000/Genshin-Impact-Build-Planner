"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Wraps an icon/element so hovering it shows a tooltip that follows the
// cursor, rather than a fixed-position one -- used for constellation and
// talent icons on the character progression editor, where the icons sit in
// a small cluster and a fixed tooltip position would frequently overlap a
// neighboring icon. Also used by WeaponCard's add-catalog hover (the same
// reasoning extends to a grid of cards), where the default inline-block
// wrapper doesn't work -- it sizes to its own content, which collapses
// when that content is itself w-full/h-full expecting a sized parent to
// fill. wrapperClassName lets a caller like that override it; widthClassName
// likewise for content that needs more room than the default w-80 (a
// weapon's passive text tends to run longer per line than a talent's).
export function MouseFollowTooltip({
  content,
  children,
  wrapperClassName = "relative inline-block",
  widthClassName = "w-80",
}: {
  content: ReactNode;
  children: ReactNode;
  wrapperClassName?: string;
  widthClassName?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Can't do this via the React onWheel prop -- React attaches wheel
    // listeners as passive by default (for scroll perf), which silently
    // ignores event.preventDefault() inside the handler instead of
    // actually blocking the native scroll. A real addEventListener with
    // passive: false is the only way to stop the page from scrolling
    // underneath the tooltip while it's being scrolled.
    function onWheel(event: WheelEvent) {
      // The tooltip is deliberately offset from the cursor (so it doesn't
      // sit under the pointer, obscuring itself), which makes it an
      // awkward, easy-to-lose target to physically move the mouse onto
      // just to scroll a long description. Scrolling it here instead,
      // while the cursor stays right where it already is (on the
      // trigger), sidesteps that entirely -- same reason a native
      // <select>'s dropdown scrolls under the pointer without needing to
      // be "entered" first.
      const tooltip = tooltipRef.current;
      if (!tooltip || tooltip.scrollHeight <= tooltip.clientHeight) return;
      event.preventDefault();
      tooltip.scrollTop += event.deltaY;
    }

    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      onMouseMove={(event) => setPos({ x: event.clientX, y: event.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <div
          ref={tooltipRef}
          className={`pointer-events-none fixed z-50 ${widthClassName} overflow-y-auto rounded-lg border border-gray-700 bg-black p-3.5 text-sm text-white shadow-lg`}
          style={{ left: pos.x + 16, top: pos.y + 16, maxHeight: `calc(100vh - ${pos.y + 16}px - 16px)` }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
