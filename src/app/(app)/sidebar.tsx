"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../(auth)/actions";
import { changeProfile } from "./actions";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 space-y-1 overflow-y-auto border-r p-4">
      {NAV_ITEMS.map((item) => {
        // A declared child page highlights itself instead (see below) --
        // the parent only falls back to prefix-matching for an undeclared
        // sub-route (none currently exist, but this keeps the old
        // behavior for one rather than leaving it unhighlighted).
        const onDeclaredChild = item.children?.some((child) => pathname === child.href) ?? false;
        const isActive = !onDeclaredChild && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${
                isActive ? "bg-foreground text-background" : "hover:bg-black/5"
              }`}
            >
              {item.label}
            </Link>
            {item.children && item.children.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {item.children.map((child) => {
                  const isChildActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      // px-4 (not an extra pl-6 indent) -- the arrow glyph
                      // itself is the first character, so its own left
                      // edge lines up directly below the parent's first
                      // word instead of sitting further right than it.
                      // pt-2/pb-1 (not py-1.5) -- same Arial line-height
                      // fix as every other text-centered control in this
                      // app (see build-stats-summary.tsx's own comment
                      // on the root cause), shifting the whole row (icon
                      // + label together) down as a unit -- separate
                      // from the arrow's own -top-1 below, which tunes
                      // its position relative to the label, not the
                      // row's own position within the link.
                      className={`flex items-center gap-1.5 rounded px-4 pb-1 pt-2 text-sm ${
                        isChildActive
                          ? "bg-foreground text-background"
                          : "text-gray-500 hover:bg-black/5 dark:text-gray-400"
                      }`}
                    >
                      {/* relative -top-1 -- the glyph's own ink sits low
                          in its character box, reading as if it trails
                          below the label text next to it; nudging it up
                          makes it look more like it's actually pointing
                          down from the parent link above. */}
                      <span aria-hidden="true" className="relative -top-1">
                        ↳
                      </span>
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="space-y-1 border-t pt-1">
        <form action={changeProfile}>
          <button type="submit" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5">
            Change Profile
          </button>
        </form>

        <form action={logout}>
          <button type="submit" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-black/5">
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}
