import { ReactNode } from "react";
import { Space_Grotesk, Inter } from "next/font/google";
import { LOCALES, LOCALE_LABELS, useLocale } from "@/i18n";
import { useSound } from "@/hooks/useSound";
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
            "px-2 py-1 text-[11px] font-medium transition-colors",
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
        "grid h-8 w-8 place-items-center rounded-lg border border-chart-700 text-chart-400 transition-colors hover:bg-chart-800 hover:text-chart-200",
        muted && "text-chart-600",
      )}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
};

const Layout = ({ children, header }: LayoutProps) => {
  const { t } = useLocale();

  return (
  <div
    className={`${inter.variable} ${spaceGrotesk.variable} relative min-h-screen font-sans`}
  >
    {/* Background: a slowly drifting graticule under two soft light pools. */}
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="graticule animate-drift absolute -inset-[10%] opacity-60" />
      <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-beacon-500/10 blur-[120px]" />
      <div className="absolute -right-32 -bottom-40 h-96 w-96 rounded-full bg-signal-500/10 blur-[120px]" />
    </div>

    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl bg-beacon-500 font-display text-lg font-bold text-chart-950"
            aria-hidden
          >
            ⌖
          </span>
          <div>
            <div className="font-display text-base leading-tight font-bold tracking-tight">
              {t("app.name")}
            </div>
            <div className="text-[11px] text-chart-500">{t("app.tagline")}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {header}
          <MuteToggle />
          <LanguageSwitch />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-8 text-center text-[11px] text-chart-600">{t("app.footer")}</footer>
    </div>
  </div>
  );
};

export default Layout;
