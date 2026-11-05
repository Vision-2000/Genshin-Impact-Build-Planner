"use client";

import { useTransition } from "react";
import { deleteProfile } from "./actions";
import { useDialogs } from "@/components/dialog-provider";

export function DeleteProfileButton({ profileId, profileName }: { profileId: number; profileName: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm } = useDialogs();

  async function handleDelete() {
    // The confirm() wait is unbounded (it resolves whenever the user gets
    // around to clicking something), so it stays outside startTransition --
    // transitions are for work that resolves soon, not for gating on a human.
    const message = `Delete profile "${profileName}"? This will permanently delete everything saved under it -- owned characters, weapons, artifacts, builds, teams, rosters, and groups. This can't be undone.`;
    const confirmed = await confirm(message, { title: "Delete profile", confirmLabel: "Delete", danger: true });
    if (!confirmed) return;
    startTransition(() => {
      deleteProfile(profileId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-sm text-red-600 underline disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
