import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Public assets have to carry the base path by hand, the same way
 * `utils/emoji.ts` and `data/citiesLoader.ts` do: CI serves the app from
 * `/<repo>` on GitHub Pages, and only `next/link` and the bundler rewrite
 * URLs for us. Paths *inside* `manifest.json` are relative, so they resolve
 * against wherever the manifest itself ends up.
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Installed as a home-screen app: standalone chrome, dark browser UI. */}
        <link rel="manifest" href={`${base}/manifest.json`} />
        <meta name="theme-color" content="#070b14" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Urban Compass" />
        {/* black-translucent lets the page paint under the status bar, which
            the safe-area padding on the fixed bars already accounts for. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href={`${base}/apple-touch-icon.png`} />
        <link rel="icon" type="image/svg+xml" href={`${base}/icon.svg`} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
