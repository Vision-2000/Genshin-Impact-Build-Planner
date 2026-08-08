import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        // Weapon and artifact icons (game_record/genshin/equip/...).
        protocol: "https",
        hostname: "upload-os-bbs.mihoyo.com",
      },
      {
        // Character icons (hoyowiki_icon) — the game_record character_icon
        // endpoint used for weapons/artifacts 404s broadly for characters,
        // so those use the wiki CDN instead, which spans these hosts.
        protocol: "https",
        hostname: "bbs.hoyolab.com",
      },
      {
        protocol: "https",
        hostname: "act-webstatic.hoyoverse.com",
      },
      {
        protocol: "https",
        hostname: "upload-static.hoyoverse.com",
      },
      {
        protocol: "https",
        hostname: "act-upload.hoyoverse.com",
      },
    ],
  },
};

export default nextConfig;
