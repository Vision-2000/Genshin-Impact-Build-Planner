"use client";

import { useState } from "react";
import Image from "next/image";

// Splash art can take a few seconds to download (a freshly-added
// character/weapon's image has never been fetched before, so there's no
// browser cache to fall back on) -- during which Image renders nothing at
// all by default. A local "loaded" flag, flipped by Image's own onLoad,
// shows a spinner over that empty space in the meantime; key={src} on the
// parent (not here) remounts this fresh per image, so a new src always
// starts from "not loaded" again rather than carrying over the previous
// one's already-true state. Shared by the character and weapon progression
// editors -- both use the exact same fill/object-fit/spinner treatment for
// their own splash-art column.
export function SplashImage({ src, objectFit }: { src: string; objectFit: "cover" | "contain" }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {/* Always rendered, never conditionally removed -- opacity toggled by
          a class instead, so the very first client render (loaded still
          false, same as the server) produces an identical tree.
          Structurally adding/removing this node based on load state caused
          a hydration mismatch for any image that happened to resolve from
          cache fast enough to flip loaded before hydration's diff settled. */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${loaded ? "opacity-0" : "opacity-100"}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className={objectFit === "contain" ? "object-contain" : "object-cover object-top"}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
