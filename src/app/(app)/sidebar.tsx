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
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded px-3 py-2 text-sm ${
              isActive ? "bg-foreground text-background" : "hover:bg-black/5"
            }`}
          >
            {item.label}
          </Link>
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
