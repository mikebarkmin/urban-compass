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
import { Glyph } from "./Glyph";

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

/** How much of the layout a screen with its own fixed bar wants left over. */
type TopBar = "none" | "present" | "chromeless";

/**
 * Screens that pin a bar to the top of the viewport — the board and the daily
 * puzzle — register it here so the layout can push its own header clear of it.
 * Without that the header slides underneath the bar and the mute and language
 * controls become unreachable for as long as the bar is up.
 *
 * A screen that carries those controls in its own bar can register as
 * "chromeless" instead, and the layout stands down entirely: inside a run the
 * wordmark and the language switch are two rows of a phone screen spent on
 * things nobody is going to use mid-game.
 */
const TopBarContext = createContext<(bar: TopBar) => void>(() => {});

/**
 * Declare that this screen renders a fixed top bar. Pass `chromeless` when it
 * also carries the controls the layout header would have offered, and the
 * header is dropped rather than pushed clear.
 */
export const useFixedTopBar = (chromeless = false) => {
  const declare = useContext(TopBarContext);
  useEffect(() => {
    declare(chromeless ? "chromeless" : "present");
    return () => declare("none");
  }, [declare, chromeless]);
};

/** The mute control, so a screen that hides the header can carry it itself. */
export { MuteToggle };

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
  const [topBar, setTopBar] = useState<TopBar>("none");
  const declareTopBar = useCallback((bar: TopBar) => setTopBar(bar), []);
  const hasTopBar = topBar !== "none";
  const chromeless = topBar === "chromeless";

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
        !hasTopBar
          ? "pt-4 sm:pt-6"
          : chromeless
            ? // Nothing below the bar but the game, so clear the bar and stop.
              "pt-[calc(4.75rem+env(safe-area-inset-top))] sm:pt-[calc(5.25rem+env(safe-area-inset-top))]"
            : "pt-[calc(5.5rem+env(safe-area-inset-top))] sm:pt-[calc(6rem+env(safe-area-inset-top))]",
      )}
    >
      {!chromeless && (
      <header className="mb-4 flex items-center justify-between gap-2 sm:mb-6 sm:gap-3">
        <Link
          href="/"
          aria-label={t("app.name")}
          className="flex min-w-0 items-center gap-2 sm:gap-2.5"
        >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-beacon-500 text-chart-950"
              aria-hidden
            >
              <Glyph name="compass" className="h-5 w-5" />
            </span>
          <div className="min-w-0">
            <div className="truncate font-display text-base leading-tight font-bold tracking-tight">
              {t("app.name")}
            </div>
            <div className="hidden truncate text-[11px] text-chart-500 sm:block">
              {t("app.tagline")}
            </div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {header}
          <MuteToggle />
          <LanguageSwitch />
        </div>
      </header>
      )}

      <main className="flex-1">{children}</main>

      {!chromeless && (
        <footer className="mt-8 text-center text-[11px] text-chart-600">{t("app.footer")}</footer>
      )}
    </div>
  </div>
  </TopBarContext.Provider>
  );
};

export default Layout;
