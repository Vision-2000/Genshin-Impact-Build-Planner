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
  // No "Create" child route -- creating a build now opens a modal directly
  // on this page (see OwnedBuildManager's own "Create build" button)
  // instead of navigating to a dedicated /builds/create page. Collections
  // (a saved combination of Builds, the build-level equivalent of Teams'
  // own Groups) are managed from within this page itself -- "collection
  // mode" -- rather than a dedicated route either, for the same reason.
  { href: "/builds", label: "Builds" },
  // Groups (a saved combination of Teams) are managed from within this
  // page itself -- "group mode" (team-manager.tsx) -- rather than a
  // dedicated route, so there's no separate nav entry for them.
  { href: "/teams", label: "Teams" },
];
