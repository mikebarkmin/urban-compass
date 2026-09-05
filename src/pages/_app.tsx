import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { LocaleProvider } from "@/i18n";
import { SoundProvider } from "@/hooks/useSound";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LocaleProvider>
      <SoundProvider>
        {/* The viewport meta belongs here rather than in `_document`, which
            Next.js warns about: `_document` renders once on the server, so a
            viewport tag there cannot be deduplicated against a page's own
            `next/head`. Pages must not re-declare it — doing so drops
            `viewport-fit`, and with it the `env(safe-area-inset-*)` padding
            that keeps the fixed bars clear of the notch and home indicator. */}
        <Head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, viewport-fit=cover"
          />
        </Head>
        <Component {...pageProps} />
      </SoundProvider>
    </LocaleProvider>
  );
}
