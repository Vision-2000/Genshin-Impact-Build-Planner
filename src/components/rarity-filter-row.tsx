"use client";

function StarIcon({ className }: { className?: string }) {
  // The path's bounding box is vertically centered at y=12, but a 5-pointed
  // star's filled area isn't -- its visual center of mass (computed via the
  // polygon centroid formula) sits at y≈13.03, about 1 unit lower. Centering
  // this box with flexbox (which centers by bounding box, not ink weight)
  // makes the star read as slightly lower than an adjacent text glyph, whose
  // own weight sits close to its box center. Shifting the viewBox's origin
  // down by that same ~1 unit re-centers the star's actual visual weight
  // instead of its bounding box.
  return (
    <svg viewBox="0 1.03 24 24" fill="currentColor" className={className}>
      <path d="M12 2 L14.9 9.1 L22.5 9.7 L16.7 14.6 L18.5 22 L12 17.8 L5.5 22 L7.3 14.6 L1.5 9.7 L9.1 9.1 Z" />
    </svg>
  );
}

// Star-rating filter badges, e.g. [5, 4] for Characters (4-5 star only) or
// [5, 4, 3] for Weapons (3-5 star). Shared so both pages get the same
// toggle/ring styling as the element/weapon-type badge rows.
export function RarityFilterRow({
  rarities,
  rarityFilter,
  onToggle,
}: {
  rarities: number[];
  rarityFilter: ReadonlySet<number>;
  onToggle: (rarity: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {rarities.map((rarity) => (
        <button
          key={rarity}
          type="button"
          onClick={() => onToggle(rarity)}
          aria-pressed={rarityFilter.has(rarity)}
          title={`${rarity} star`}
          className={`flex h-10 items-center gap-0.5 rounded-full bg-black/40 pl-2 pr-1.5 ring-2 ${
            rarityFilter.has(rarity) ? "ring-blue-500" : "ring-foreground"
          }`}
        >
          <span className="text-sm font-medium text-white">{rarity}</span>
          <StarIcon className="h-4 w-4 text-yellow-400" />
        </button>
      ))}
    </div>
  );
}
