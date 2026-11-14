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
      // leading-none -- without it, the "?" sits in a default-line-height
      // box taller than the glyph itself, so items-center/justify-center
      // center THAT inflated box rather than the glyph, reading as
      // off-center within this fixed h-6 w-6 circle.
      className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-500 text-base font-semibold leading-none text-gray-300 hover:bg-white/10"
    >
      ?
    </button>
  );
}
