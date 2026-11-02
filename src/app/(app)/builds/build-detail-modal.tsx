"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { getBuildDetail, type BuildDetail } from "./actions";
import { BuildStatsSummary } from "./build-stats-summary";

// Read-only "view build details" popover -- reuses BuildStatsSummary (the
// same Stats/Talents/Constellations/Artifact Set Effects boxes the Builds
// page's own create/edit flow already shows) fed by a single on-demand
// fetch (getBuildDetail) rather than the full owned-character/weapon/
// artifact catalogs the Builds page's own editor needs for its pickers.
// Triggered from the Teams page's own build-slot cards (see build-slot-
// picker.tsx's own "View" zone) without navigating away from Teams --
// stays mounted (and keeps its own open/buildId state) regardless of
// which slot last triggered it, same one-modal-per-page-section pattern
// BuildSlotPicker's own swap modal already uses.
//
// Fetches fresh every time buildId changes (including re-opening the SAME
// build) rather than caching -- a build's own level/talents/artifacts can
// change between views, and this is a single small query, not worth
// caching against going stale.
export function BuildDetailModal({ buildId, onClose }: { buildId: number | null; onClose: () => void }) {
  // Tagged with the buildId it was actually fetched for, not reset
  // separately when buildId changes -- a synchronous setState at the top
  // of an effect body (to clear stale data before the fetch starts) is
  // exactly what React's own set-state-in-effect rule flags. Comparing
  // result.buildId against the current buildId below derives "stale, show
  // loading" during render instead, so the only setState call here is the
  // one already inside the fetch's own .then() callback.
  const [result, setResult] = useState<{ buildId: number; detail: BuildDetail } | { buildId: number; error: string } | null>(
    null
  );

  useEffect(() => {
    if (buildId === null) return;
    let cancelled = false;
    getBuildDetail(buildId).then((res) => {
      if (cancelled) return;
      setResult("error" in res ? { buildId, error: res.error } : { buildId, detail: res.detail });
    });
    return () => {
      cancelled = true;
    };
  }, [buildId]);

  const current = result && result.buildId === buildId ? result : null;
  const detail = current && "detail" in current ? current.detail : null;
  const error = current && "error" in current ? current.error : null;

  return (
    <Modal
      open={buildId !== null}
      onClose={onClose}
      title={detail ? `${detail.character.name} — ${detail.name}` : "Build details"}
      maxWidthClassName="max-w-4xl"
    >
      {/* Fixed height, not h-full -- on the Builds page itself
          BuildStatsSummary's own h-full tracks a character splash-art
          sibling's height; standalone here, with no such sibling, it
          needs an explicit height to stretch against instead. */}
      <div className="h-[32rem]">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : !detail ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <BuildStatsSummary character={detail.character} weapon={detail.weapon} artifacts={detail.artifacts} />
        )}
      </div>
    </Modal>
  );
}
