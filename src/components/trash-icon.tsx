// Same inline-SVG convention as Modal's own close icon -- viewBox 0 0 16 16,
// stroke currentColor, no fill. Used by the weapons/artifacts bulk-delete
// toolbar button (a few places could reuse it later; not worth its own prop
// surface beyond className until a second shape is actually needed).
export function TrashIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M5.5 7.5v4M8 7.5v4M10.5 7.5v4" />
      <path d="M4 4.5l.6 8.4a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.4" />
    </svg>
  );
}
