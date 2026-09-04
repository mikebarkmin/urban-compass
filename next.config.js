/**
 * The app ships as a static bundle on GitHub Pages, so everything has to be
 * pre-rendered. `NEXT_PUBLIC_BASE_PATH` is set by CI to the repository name
 * (e.g. "/urban-compass") and left empty for local development or a custom
 * domain served from the root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  // Emits `daily/index.html` instead of `daily.html`, which GitHub Pages
  // resolves without any redirect trickery.
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
