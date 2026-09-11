"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// An owned-item page (Weapons, Artifacts, Builds) shows server-fetched data
// alongside client-side edits that write straight to the DB. Next's client
// router cache can restore a stale render of this page on the browser's
// Back/Forward buttons -- e.g. after editing something, following a link to
// that feature's /add page, and coming back -- showing the pre-edit
// snapshot even though the edit is correctly saved.
//
// popstate is the correct signal (fires for History API back/forward within
// the same document, unlike the Navigation Timing API or the pageshow/
// persisted bfcache flag, neither of which fire for a same-document
// client-side route change -- both prior attempts at this targeted the
// wrong kind of event entirely). The router.refresh() call happens directly
// in the event handler, not via a flag checked in a later effect: an effect
// only re-runs when ITS OWN dependencies change, and a module-level
// variable being mutated by an unrelated event listener doesn't trigger
// that -- so a flag-then-check-in-effect approach silently never re-fires
// if this component doesn't happen to remount for that particular
// navigation. Calling refresh() immediately, right when the browser event
// fires, has no such dependency on this component's own render cycle.
let latestRouter: ReturnType<typeof useRouter> | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    latestRouter?.refresh();
  });
}

export function useRefreshOnBackNavigation() {
  const router = useRouter();
  // Mutating a module-level variable during render is a side effect (flagged
  // by the react-compiler purity lint rule) -- keeping it in sync belongs in
  // an effect instead. router's identity is stable across re-renders in
  // practice, so this effect only really runs once per mount, but this is
  // the correct place for it regardless.
  useEffect(() => {
    latestRouter = router;
  }, [router]);
}
