import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { LocaleProvider } from "@/i18n";
import { SoundProvider } from "@/hooks/useSound";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LocaleProvider>
      <SoundProvider>
        <Component {...pageProps} />
      </SoundProvider>
    </LocaleProvider>
  );
}
