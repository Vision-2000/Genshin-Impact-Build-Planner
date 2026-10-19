"use client";

import Image from "next/image";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { MouseFollowTooltip } from "@/components/mouse-follow-tooltip";

// A small, chrome-free thumbnail -- just the icon over its rarity-gradient
// background, no badges/name/overlay -- for contexts that need to show
// several items at once in a compact row rather than the full WeaponCard/
// ArtifactCard grid treatment (too large, and WeaponCard/ArtifactCard's own
// bottom gradient-for-text-legibility band would paint even with no text
// under it). Used by the weapons/artifacts bulk-delete confirmation to let
// the user double check exactly which items they're about to delete, with
// the same hover-for-details tooltip the full card gives.
export function MiniatureCard({
  iconUrl,
  alt,
  rarity,
  objectFit,
  hoverContent,
}: {
  iconUrl: string | null;
  alt: string;
  rarity: number;
  objectFit: "cover" | "contain";
  hoverContent?: React.ReactNode;
}) {
  const body = (
    <div
      className={`relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-lg border-4 border-gray-600 shadow ${rarityGradientClasses(rarity)}`}
    >
      {iconUrl && (
        <Image
          src={iconUrl}
          alt={alt}
          fill
          sizes="84px"
          className={objectFit === "contain" ? "object-contain p-1" : "object-cover"}
        />
      )}
    </div>
  );

  if (!hoverContent) return body;

  return (
    <MouseFollowTooltip wrapperClassName="relative inline-block" content={hoverContent}>
      {body}
    </MouseFollowTooltip>
  );
}
