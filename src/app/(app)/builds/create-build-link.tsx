"use client";

import Link from "next/link";
import { DRAFT_KEY } from "./create/build-catalog";

// Deliberately starting a new build from here is a fresh session, not a
// continuation of whatever was in progress on /builds/create before --
// clear any leftover draft so it doesn't resurface. Returning to
// /builds/create via the browser Back button (e.g. after following the
// picker's "Add weapon" link) never goes through this click handler, so
// that path still restores the in-progress draft as expected.
export function CreateBuildLink() {
  return (
    <Link
      href="/builds/create"
      onClick={() => {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // Ignore -- worst case the draft (if any) gets restored anyway.
        }
      }}
      className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-black/5"
    >
      <span className="text-base leading-none">+</span> Create build
    </Link>
  );
}
