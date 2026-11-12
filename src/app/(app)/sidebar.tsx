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
              // Same treatment as a parent link (block rounded py-2 text-sm,
              // same active/hover classes) rather than its own
              // arrow-prefixed style -- pl-6 instead of px-3's own pl-3
              // for a plain left indent (no arrow glyph to line up
              // against anything), plus the inactive state's own dimmed
              // text-gray-500/dark:text-gray-400 kept as a second,
              // non-indent way to tell a child link apart from a parent
              // one at a glance.
              <div className="mt-0.5 space-y-0.5">
                {item.children.map((child) => {
                  const isChildActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block rounded py-2 pl-6 pr-3 text-sm ${
                        isChildActive
                          ? "bg-foreground text-background"
                          : "text-gray-500 hover:bg-black/5 dark:text-gray-400"
                      }`}
                    >
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
