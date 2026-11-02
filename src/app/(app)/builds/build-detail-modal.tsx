"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { getBuildDetail, type BuildDetail } from "./actions";
import { BuildViewer } from "./build-viewer";

// Read-only "view build details" popover -- BuildViewer (a true read-only
// counterpart to BuildEditor, not a simplified stand-in) fed by a single
// on-demand fetch (getBuildDetail) rather than the full owned-character/
// weapon/artifact catalogs the Builds page's own editor needs for its
// pickers. Triggered from the Teams page's own build-slot cards (see
// build-slot-picker.tsx's own "View" zone) without navigating away from
// Teams -- stays mounted (and keeps its own open/buildId state) regardless
// of which slot last triggered it, same one-modal-per-page-section pattern
// BuildSlotPicker's own swap modal already uses.
//
// Fetches fresh every time buildId changes (including re-opening the SAME
// build) rather than caching -- a build's own level/talents/artifacts can
// change between views, and this is a single small query, not worth
// caching against going stale.
export function BuildDetailModal({
  buildId,
  weaponConflict = false,
  conflictingArtifactIds = [],
  onClose,
}: {
  buildId: number | null;
  // Teams page only (team-manager.tsx's own computeTeamConflicts) -- true/
  // non-empty when "View" was opened from a team slot whose weapon/
  // artifact is currently shared with another build in that same team.
  // Both default to false/empty for any other caller.
  weaponConflict?: boolean;
  conflictingArtifactIds?: number[];
  onClose: () => void;
}) {
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
      // max-w-7xl -- the exact same width the Builds page's own BuildEditor/
      // BuildCatalog modals use (owned-build-manager.tsx/build-catalog.tsx).
      // max-w-4xl (tried first) left BuildStatsSummary's own Column 2
      // (Talents/Constellations/Artifact Set Effects, each a flex-wrap icon
      // row) too narrow to fit on one line the way it does there, wrapping
      // to multiple rows and reading as a cut-down version of the real
      // thing instead of the genuinely identical one this is meant to be.
      maxWidthClassName="max-w-7xl"
    >
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !detail ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <BuildViewer
          character={detail.character}
          weapon={detail.weapon}
          artifacts={detail.artifacts}
          weaponConflict={weaponConflict}
          conflictingArtifactIds={conflictingArtifactIds}
        />
      )}
    </Modal>
  );
}
