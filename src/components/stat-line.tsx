// A grid cell that never resizes as `current` changes: `ghost` (normal
// flow, invisible) is what actually determines the cell's max-content
// width, while `current` (absolutely positioned over it) is what's
// actually seen. Pass the worst-case text this cell could ever show as
// `ghost` and the column is pre-sized for it from the start -- no reflow
// as the user drags a slider, since the space was already reserved for
// something at least as wide as any value that could land there. Shared
// by the character progression editor's own base-stats box and the
// weapon progression form's own base-stats box (extracted here once the
// second call site needed it).
export function StatLine({ current, ghost }: { current: string; ghost: string }) {
  return (
    <li className="relative">
      <span className="invisible">{ghost}</span>
      <span className="absolute inset-0">{current}</span>
    </li>
  );
}
