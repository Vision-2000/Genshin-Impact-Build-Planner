export type NavItem = {
  href: string;
  label: string;
};

// Add an entry here in the same commit that builds the page it points to.
export const NAV_ITEMS: NavItem[] = [
  { href: "/characters", label: "Characters" },
  { href: "/weapons", label: "Weapons" },
  { href: "/artifacts", label: "Artifacts" },
  { href: "/builds", label: "Builds" },
  { href: "/teams", label: "Teams" },
];
