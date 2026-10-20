export type NavChildItem = {
  href: string;
  label: string;
};

export type NavItem = {
  href: string;
  label: string;
  // Sub-pages shown as their own indented row directly below this item
  // (e.g. Weapons -> Add), so a user can jump straight to them instead of
  // navigating to the parent page first and clicking a link from there.
  children?: NavChildItem[];
};

// Add an entry here in the same commit that builds the page it points to.
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/characters",
    label: "Characters",
    children: [{ href: "/characters/roster", label: "Roster" }],
  },
  { href: "/weapons", label: "Weapons", children: [{ href: "/weapons/add", label: "Add" }] },
  { href: "/artifacts", label: "Artifacts", children: [{ href: "/artifacts/add", label: "Add" }] },
  { href: "/builds", label: "Builds", children: [{ href: "/builds/create", label: "Create" }] },
  { href: "/teams", label: "Teams" },
  { href: "/rosters", label: "Rosters" },
  { href: "/lineups", label: "Lineups" },
];
