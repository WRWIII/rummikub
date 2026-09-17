import type { MetadataRoute } from "next";

/**
 * The manifest is a Route Handler under the hood, and `output: 'export'`
 * requires every route to declare itself static before it will prerender one
 * into out/.
 */
export const dynamic = "force-static";

/**
 * Served at /manifest.webmanifest; Next injects the <link rel="manifest">.
 * Must not touch any request-time API, or it won't prerender into out/.
 *
 * Note on `orientation`: Android honours it for an installed app. iOS ignores
 * it entirely — portrait there is a CSS concern, not a manifest one.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rummikub Turn Timer",
    short_name: "Turn Timer",
    description:
      "A full-screen tap-to-reset turn timer and scorekeeper for Rummikub.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#072620",
    theme_color: "#0e3b2e",
    categories: ["games", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
