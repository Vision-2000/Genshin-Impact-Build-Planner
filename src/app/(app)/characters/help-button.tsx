"use client";

import { useDialogs } from "@/components/dialog-provider";

const HELP_TEXT = `Search by name, or use the badges below to filter by element, weapon type, or rarity -- click a badge to toggle it on, and combine as many as you like.

Use the ownership dropdown to show All / Owned / Not owned characters, and the sort dropdown to order by name or rarity.

Click anywhere on a character's card to mark it owned or not owned. A green border means it's in your owned roster; the border stays gray otherwise.`;

export function HelpButton() {
  const { notify } = useDialogs();

  return (
    <button
      type="button"
      onClick={() => notify(HELP_TEXT, { title: "Characters page help" })}
      title="Help"
      aria-label="Help"
      className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-400 text-base font-semibold text-gray-500 hover:bg-black/5"
    >
      ?
    </button>
  );
}
