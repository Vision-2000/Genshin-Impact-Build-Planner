// Small inline "←" icon, drawn as an SVG path rather than the Unicode
// arrow character -- same reasoning as PlusIcon's own comment (plus-icon.tsx):
// a Unicode arrow is typically drawn on the font's own math axis too, which
// doesn't line up with the optical center of the plain text it sits next
// to, and no amount of CSS line-height tuning fixes that. The path is a
// horizontal line plus a chevron, explicitly centered at y=8 of a 0-16
// viewBox -- deterministic regardless of what font is active.
export function ArrowLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 8H2M7 3 2 8l5 5" />
    </svg>
  );
}
