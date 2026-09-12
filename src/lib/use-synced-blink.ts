"use client";

import { useEffect, useState, type CSSProperties } from "react";

const BLINK_DURATION_MS = 2500;

// The blinking "+" placeholder appears independently in every empty weapon/
// artifact slot in a build's creation form. A plain CSS animation starts its
// own clock at whatever real moment its element mounts -- fine when every
// slot mounts together on the page's initial load, but a slot that's filled
// and later cleared re-mounts its blinking icon at a different moment than
// slots that have been idle the whole time, drifting out of phase even
// though every instance shares the same duration.
//
// Anchoring animation-delay to a negative offset derived from the wall
// clock, modulo the animation's own duration, puts every instance's
// phase-zero on the same absolute-time boundary regardless of when it
// actually mounts, so all instances always look synchronized.
//
// Starts undefined (no override, matching the server-rendered markup) and
// is set post-hydration -- computing this from Date.now() directly during
// render would differ between the server's render time and the client's
// hydration time, causing a hydration mismatch.
export function useSyncedBlinkStyle(): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStyle({ animationDelay: `-${(Date.now() % BLINK_DURATION_MS) / 1000}s` });
  }, []);

  return style;
}
