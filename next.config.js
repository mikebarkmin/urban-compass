/**
 * The app ships as a static bundle on GitHub Pages, so everything has to be
 * pre-rendered. `NEXT_PUBLIC_BASE_PATH` is set by CI to the repository name
 * (e.g. "/urban-compass") and left empty for local development or a custom
 * domain served from the root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Join the hand-authored daily boards with the gazetteer before anything is
// compiled, so `game/data/dailyBoards.generated.json` is always in step with
// `game/data/daily/` and `public/cities5000.json`. Running it here means every
// `next dev` and `next build` does it — there is no step to forget, and no
// index file listing the boards by hand. A bad board id throws, which fails
// the build rather than shipping a broken day.
require("node:child_process").execFileSync(
  process.execPath,
  [require("node:path").join(__dirname, "scripts", "build-daily.mjs")],
  { stdio: "inherit" },
);

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
