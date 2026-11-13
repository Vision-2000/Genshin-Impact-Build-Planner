// Small inline "+" icon, drawn as an SVG path rather than the Unicode "+"
// character -- same reasoning BlinkingPlusIcon (blinking-plus-icon.tsx)
// already has for its own identical path, just without the blink
// animation: a Unicode glyph's own vertical position within its line box
// is a font-rendering decision outside CSS's control (symbols like "+"
// are typically drawn centered on the font's own math axis, which sits
// higher than the optical center of the mixed-case text it usually sits
// next to), so no amount of leading-none/line-height tuning can reliably
// center it next to plain text -- confirmed directly: that was already
// tried and still read as off. width/height 1em ties this to whatever
// font-size the surrounding text uses, so it drops into an existing
// "icon + text" row without its own size prop.
export function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}
