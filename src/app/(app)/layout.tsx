import { Sidebar } from "./sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {/* scrollbar-gutter:stable reserves this scrollbar's own width always
          -- this main panel (not html/body, which never scrolls in this
          sidebar layout) is the actual scrolling element for every page,
          so without this, a filterable grid shrinking/growing past the
          viewport threshold visibly shifts the whole page left/right as
          the scrollbar appears/disappears. */}
      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">{children}</main>
    </div>
  );
}
