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
// Set the instant a real Back/Forward happens, read (and cleared) by
// wasBackNavigation() below -- a module-level flag, not component state,
// for the same reason latestRouter itself is one: it has to survive this
// component unmounting and a fresh one remounting in its place, which is
// exactly what a Back/Forward navigation that lands on a NEW page instance
// does. Teams page uses this to decide whether a leftover "which modal was
// open" sessionStorage draft (team-manager.tsx) should actually be
// restored -- only ever true for a genuine Back/Forward round trip, never
// for an ordinary nav-bar/sidebar Link click to the same route, which
// should always start from a clean, modal-free page.
let poppedSincePageLoad = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    poppedSincePageLoad = true;
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

// Reads AND clears the "a Back/Forward just happened" flag -- clearing it
// here (not leaving it set) means only the very next check sees a given
// popstate; a later ordinary mount (e.g. navigating elsewhere and back via
// the nav bar, no further Back/Forward involved) correctly sees false
// again instead of forever treating every mount as a Back-navigation one
// just because the user used Back at some earlier point in the session.
// Call from an effect (e.g. right alongside useRefreshOnBackNavigation's
// own mount-time sync), not during render -- reading mutates module state.
export function wasBackNavigation(): boolean {
  const popped = poppedSincePageLoad;
  poppedSincePageLoad = false;
  return popped;
}
