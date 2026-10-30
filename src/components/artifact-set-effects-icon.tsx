import Image from "next/image";
import { DEFAULT_WEAPON_RARITY } from "@/lib/default-weapon";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import type { ActiveSetEffectItem } from "@/lib/active-set-effects";

// Shared by the Builds page's own BuildCard and the Teams page's own
// build-slot badge (src/app/(app)/teams/build-slot-picker.tsx) -- extracted
// once a second call site needed the exact same "show what artifact set
// effects are active" icon treatment, just at a different size/shape (a
// square tile there, a small circular badge here -- both work since this
// renders only position:absolute fill content and leaves sizing/shape
// (square vs. rounded-full) and overflow-hidden to the caller's own sized
// wrapper).
//
// No active set effects falls back to the same 1-star rarity gradient an
// unequipped weapon slot uses (DEFAULT_WEAPON_RARITY) -- a deliberate
// "nothing active" state, not a transparent gap that would let whatever
// sits behind this element show through instead. A single set already at
// 4pc shows its own plain icon: 4pc already consumes 4 of a build's 5
// artifact slots, leaving no room for a genuine second set to ever join it,
// so there's nothing a diagonal split would usefully represent there. 1 or
// 2 standalone 2pc sets share one diagonally-split box (top-right to
// bottom-left) instead of two separate icons side by side -- each half
// carries its own rarity gradient (not one shared background), so a mixed-
// rarity pair doesn't collapse into a single color; the second half falls
// back to the same DEFAULT_WEAPON_RARITY treatment as the empty state when
// there's no second set yet.
export function ArtifactSetEffectsIcon({ activeSetEffects }: { activeSetEffects: ActiveSetEffectItem[] }) {
  const [firstEffect, secondEffect] = activeSetEffects;

  if (!firstEffect) {
    return <div className={`absolute inset-0 ${rarityGradientClasses(DEFAULT_WEAPON_RARITY)}`} />;
  }

  if (!secondEffect && firstEffect.maxPiece === 4) {
    return (
      <div
        title={`${firstEffect.setName} (4pc)`}
        className={`absolute inset-0 ${rarityGradientClasses(firstEffect.rarity)}`}
      >
        {firstEffect.flowerIconUrl && (
          <Image src={firstEffect.flowerIconUrl} alt={firstEffect.setName} fill className="object-contain p-1" />
        )}
      </div>
    );
  }

  return (
    <div
      title={activeSetEffects.map((e) => `${e.setName} (${e.maxPiece}pc)`).join(" / ")}
      className="absolute inset-0"
    >
      <div
        className={`absolute inset-0 ${rarityGradientClasses(firstEffect.rarity)}`}
        style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
      >
        {firstEffect.flowerIconUrl && (
          <Image src={firstEffect.flowerIconUrl} alt={firstEffect.setName} fill className="object-contain p-1" />
        )}
      </div>
      <div
        className={`absolute inset-0 ${rarityGradientClasses(secondEffect?.rarity ?? DEFAULT_WEAPON_RARITY)}`}
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
      >
        {secondEffect?.flowerIconUrl && (
          <Image src={secondEffect.flowerIconUrl} alt={secondEffect.setName} fill className="object-contain p-1" />
        )}
      </div>
      {/* The dividing line itself -- a thin opaque band at the gradient's
          own midpoint, transparent either side of it. 135deg (not 45deg) is
          what makes the band run from the top-right corner to the bottom-
          left corner on a square box, matching the two clip-path triangles
          above exactly -- still true once a circular caller clips this
          square content into a circle. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, transparent calc(50% - 0.5px), rgba(255,255,255,0.85) calc(50% - 0.5px), rgba(255,255,255,0.85) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
        }}
      />
    </div>
  );
}
