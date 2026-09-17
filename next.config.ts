import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory otherwise makes Turbopack guess the
  // workspace root and warn on every build.
  turbopack: { root: path.resolve(__dirname) },

  // Static export: `next build` emits a self-contained `out/` directory that
  // deploys unchanged to Vercel, Cloudflare Pages, or any static host.
  output: "export",

  // Emits `/score/index.html` rather than `/score.html`. Directory indexes
  // resolve identically on every static host with no rewrite rules.
  trailingSlash: true,

  // The default image loader requires a server. We don't use next/image, but
  // this guards against someone reaching for it later and breaking the build.
  images: { unoptimized: true },

  // Stamped into the service worker registration URL so every deploy is a
  // byte-different script to the browser. Falls back to a timestamp locally.
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.NEXT_PUBLIC_BUILD_ID ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.CF_PAGES_COMMIT_SHA ??
      String(Date.now()),
  },
};

export default nextConfig;
