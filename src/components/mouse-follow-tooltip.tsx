"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
  // Whether the tooltip's right edge would actually overflow the viewport
  // at a plain left anchor -- NOT "is the cursor past the midpoint," which
  // flipped the anchor side constantly as the cursor crossed center even
  // when the tooltip fit fine on either side, a jarring, unnecessary jump
  // every time. Measured via the layout effect below instead of guessed
  // from widthClassName, so this works for any width without having to
  // keep a parsed pixel value in sync with that prop.
  const [flip, setFlip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Runs before the browser paints, so correcting a wrong guess here never
  // flashes the overflowing frame -- render once at the default left
  // anchor, measure the now-real DOM width (unaffected by which anchor is
  // applied, only widthClassName controls it), and flip only if that
  // position would actually run past the viewport's right edge.
  useLayoutEffect(() => {
    // Nothing to measure while hidden -- flip's value doesn't matter here
    // anyway, since the tooltip itself isn't rendered when pos is null.
    if (!pos) return;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    setFlip(pos.x + 16 + tooltip.offsetWidth > window.innerWidth);
  }, [pos]);

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
          style={{
            // Anchoring purely by a fixed left offset from the cursor let
            // the tooltip's right edge run past the viewport whenever the
            // cursor was far enough right (e.g. the rightmost column of a
            // card grid) -- flip (set above, only once that would actually
            // happen) switches to a `right` anchor instead, which keeps
            // the tooltip's right edge on-screen regardless of width, the
            // same way maxHeight below already keeps the bottom edge
            // on-screen regardless of height.
            ...(flip ? { right: window.innerWidth - pos.x + 16 } : { left: pos.x + 16 }),
            top: pos.y + 16,
            maxHeight: `calc(100vh - ${pos.y + 16}px - 16px)`,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
