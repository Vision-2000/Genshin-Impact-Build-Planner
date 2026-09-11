import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Every page here is per-profile, live data (owned characters/weapons/
    // artifacts/builds) edited via Server Actions that write straight to the
    // DB. The client router cache's default staleTime can otherwise let an
    // ordinary same-tab Link navigation back to one of these pages reuse a
    // snapshot from before an edit -- 0 makes every navigation to a dynamic
    // route always refetch instead. (Browser Back/Forward is a separate
    // case, not covered by this setting -- see
    // src/lib/use-refresh-on-back-navigation.ts.)
    staleTimes: {
      dynamic: 0,
    },
  },
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
