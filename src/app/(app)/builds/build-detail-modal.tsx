"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  selectAction,
  onClose,
}: {
  buildId: number | null;
  // Teams page only (team-manager.tsx's own computeTeamConflicts) -- true/
  // non-empty when "View" was opened from a team slot whose weapon/
  // artifact is currently shared with another build in that same team.
  // Both default to false/empty for any other caller.
  weaponConflict?: boolean;
  conflictingArtifactIds?: number[];
  // The header's own "selection" button, next to Edit build -- its label
  // and behavior depend on where "View" was opened from, so the caller
  // owns both rather than this component guessing at wording:
  // - team-manager.tsx (a team's own filled slot): "Select another
  //   build", closes this modal and reopens the originating slot's own
  //   BuildSlotPicker.
  // - build-slot-picker.tsx (a candidate in the "Choose build" modal's own
  //   grid): "Select build", picks exactly this candidate -- the same
  //   effect as clicking its card directly -- and closes both modals.
  // Omitted entirely (not just a no-op) for any other caller, which hides
  // the button -- there's nothing to select from outside either flow.
  selectAction?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  const router = useRouter();
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

  // Smaller than Modal's own h-10 close button (h-7, tighter px) -- two
  // text buttons at that height read as oversized next to the plain X;
  // items-center keeps all three vertically aligned in the shared
  // top-right row despite the height difference -- see Modal's own
  // headerActions comment.
  const headerButtonClassName =
    "flex h-7 items-center whitespace-nowrap rounded border px-2 text-xs font-semibold hover:bg-white/10";

  const headerActions =
    buildId !== null ? (
      <>
        {selectAction && (
          <button type="button" onClick={selectAction.onClick} className={headerButtonClassName}>
            {selectAction.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push(`/builds?edit=${buildId}`)}
          className={headerButtonClassName}
        >
          Edit build
        </button>
      </>
    ) : null;

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
      headerActions={headerActions}
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
