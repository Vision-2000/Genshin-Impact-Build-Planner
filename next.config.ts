import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        // Enka Network mirrors the game's UI asset files directly — see the
        // comment on enkaIconUrl() in prisma/seed.ts for why this replaced
        // HoYoLAB's mihoyo_icon/hoyowiki_icon endpoints (both have a
        // meaningful dead-link rate; this one doesn't).
        protocol: "https",
        hostname: "enka.network",
      },
    ],
  },
};

export default nextConfig;
