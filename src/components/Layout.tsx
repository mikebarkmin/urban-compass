import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { Space_Grotesk, Inter } from "next/font/google";
import { LOCALES, LOCALE_LABELS, useLocale } from "@/i18n";
import { useSound } from "@/hooks/useSound";
import { Emoji } from "./Emoji";
import { cx } from "./ui";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

interface LayoutProps {
  children: ReactNode;
  /** Rendered in the header, next to the wordmark. */
  header?: ReactNode;
}

/**
 * Screens that pin a bar to the top of the viewport — the board and the daily
 * puzzle — register it here so the layout can push its own header clear of it.
 * Without that the header slides underneath the bar and the mute and language
 * controls become unreachable for as long as the bar is up.
 */
const TopBarContext = createContext<(present: boolean) => void>(() => {});

/** Declare that this screen renders a fixed top bar. */
export const useFixedTopBar = () => {
  const declare = useContext(TopBarContext);
  useEffect(() => {
    declare(true);
    return () => declare(false);
  }, [declare]);
};

/** Two buttons rather than a select: there are only ever two languages. */
const LanguageSwitch = () => {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-chart-700"
      role="radiogroup"
      aria-label={t("app.language")}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={locale === option}
          onClick={() => setLocale(option)}
          className={cx(
            "tap-target inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-medium transition-colors",
            locale === option
              ? "bg-chart-700 text-chart-100"
              : "text-chart-500 hover:bg-chart-800 hover:text-chart-200",
          )}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  );
};

const MuteToggle = () => {
  const { muted, toggleMuted } = useSound();
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={toggleMuted}
      title={muted ? t("app.unmute") : t("app.mute")}
      aria-label={muted ? t("app.unmute") : t("app.mute")}
      aria-pressed={muted}
      className={cx(
        "tap-target grid h-8 w-8 place-items-center rounded-lg border border-chart-700 text-chart-400 transition-colors hover:bg-chart-800 hover:text-chart-200",
        muted && "text-chart-600",
      )}
    >
      {muted ? <Emoji symbol="🔇" alt={t("app.unmute")} className="h-5 w-5" /> : <Emoji symbol="🔊" alt={t("app.mute")} className="h-5 w-5" />}
    </button>
  );
};

const Layout = ({ children, header }: LayoutProps) => {
  const { t } = useLocale();
  const [hasTopBar, setHasTopBar] = useState(false);
  const declareTopBar = useCallback((present: boolean) => setHasTopBar(present), []);

  return (
  <TopBarContext.Provider value={declareTopBar}>
  <div
    className={`${inter.variable} ${spaceGrotesk.variable} relative min-h-dvh font-sans`}
  >
    {/* Background: a slowly drifting graticule under two soft light pools. */}
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="graticule animate-drift absolute -inset-[10%] opacity-60" />
      <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-beacon-500/10 blur-[120px]" />
      <div className="absolute -right-32 -bottom-40 h-96 w-96 rounded-full bg-signal-500/10 blur-[120px]" />
    </div>

    <div
      className={cx(
        "relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-4 sm:px-6 sm:pb-6",
        // Clear the fixed bar (and the notch above it) when a screen has one.
        // The bar is 65px tall, 69px from `sm` up. The header needs more air
        // above it than the 16px it keeps below, or it reads as a second bar
        // stuck to the first rather than as the top of the content.
        hasTopBar
          ? "pt-[calc(5.5rem+env(safe-area-inset-top))] sm:pt-[calc(6rem+env(safe-area-inset-top))]"
          : "pt-4 sm:pt-6",
      )}
    >
      <header className="mb-4 flex items-center justify-between gap-2 sm:mb-6 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <Link href="/" aria-label={t("app.name")}>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-beacon-500 font-display text-lg font-bold text-chart-950"
              aria-hidden
            >
              ⌖
            </span>
          </Link>
          <div className="min-w-0">
            <div className="truncate font-display text-base leading-tight font-bold tracking-tight">
              {t("app.name")}
            </div>
            <div className="hidden truncate text-[11px] text-chart-500 sm:block">
              {t("app.tagline")}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {header}
          <MuteToggle />
          <LanguageSwitch />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-8 text-center text-[11px] text-chart-600">{t("app.footer")}</footer>
    </div>
  </div>
  </TopBarContext.Provider>
  );
};

export default Layout;
