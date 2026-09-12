"use client";

import { useSyncedBlinkStyle } from "@/lib/use-synced-blink";

// The blinking "+" shown over an empty weapon/artifact slot. Its own effect
// (inside useSyncedBlinkStyle) needs to re-fire every time THIS icon actually
// (re)mounts -- not just once for the picker component's whole lifetime --
// since a slot that's filled and later cleared re-mounts this icon (a plain
// CSS animation's timeline is anchored to its own element's mount moment) at
// a real, later time than slots that have been idle since the page loaded.
// Keeping this in its own component, rather than computing the style
// directly in the picker, is what makes that re-firing happen: the picker
// itself never unmounts when a slot's selection changes (only the ternary
// branch inside it swaps), so a hook call sitting in the picker's own body
// would only ever run its mount effect once, computing a delay anchored to
// the picker's original mount time -- stale for any icon that (re)appears
// later. This component, in contrast, actually unmounts and remounts each
// time the parent's ternary switches it back into the tree, so its effect
// fires fresh at that real moment every time.
export function BlinkingPlusIcon() {
  const style = useSyncedBlinkStyle();
  return (
    <svg
      viewBox="0 0 16 16"
      width={64}
      height={64}
      style={style}
      className="relative text-foreground [animation:blink_2.5s_ease-in-out_infinite]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}
