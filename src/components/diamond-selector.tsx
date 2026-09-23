// A row of diamonds representing a small tiered value -- currently just
// ascension phase (Characters and Weapons both use one of these). Positions
// 1..count light up to the current value, unlit beyond it. Clicking a
// diamond sets that position, unless it's already the current (topmost lit)
// one, in which case it steps back down by one instead -- this is what
// keeps `minValue` (phase 0, "unascended") reachable by mouse at all,
// since there's no separate unlit-only diamond to click for it.
export function DiamondSelector({
  count,
  value,
  minValue = 0,
  onChange,
  litClassName,
  ariaLabel,
}: {
  count: number;
  value: number;
  minValue?: number;
  onChange: (value: number) => void;
  // e.g. "border-amber-400 bg-amber-400"
  litClassName: string;
  ariaLabel: (position: number) => string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {Array.from({ length: count }, (_, i) => i + 1).map((position) => {
        const lit = position <= value;
        return (
          <button
            key={position}
            type="button"
            aria-label={ariaLabel(position)}
            aria-pressed={lit}
            onClick={() => onChange(position === value ? Math.max(minValue, position - 1) : position)}
            className={`h-4 w-4 rotate-45 border-2 transition-colors ${
              lit ? litClassName : "border-gray-500 bg-transparent hover:border-gray-400"
            }`}
          />
        );
      })}
    </div>
  );
}
