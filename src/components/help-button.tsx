"use client";

import { useDialogs } from "@/components/dialog-provider";

// Small "?" button next to a page heading; opens the existing themed dialog
// (via notify()) with page-specific explanatory text passed in by the caller.
export function HelpButton({ title, text }: { title: string; text: string }) {
  const { notify } = useDialogs();

  return (
    <button
      type="button"
      onClick={() => notify(text, { title })}
      title="Help"
      aria-label="Help"
      className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-400 text-base font-semibold text-gray-500 hover:bg-black/5 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-white/10"
    >
      ?
    </button>
  );
}
