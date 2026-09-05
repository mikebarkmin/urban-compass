import { useEffect, useRef, useState } from "react";
import { LogEntry } from "../../game/logic";
import { ALL_CATEGORIES, Category, categoryIcons } from "../../game/cities";
import { useLocale } from "@/i18n";
import { useSound } from "@/hooks/useSound";
import { cx } from "./ui";

/**
 * The four log keys worth interrupting for, and whether each one landed. A
 * call and a doubt are the only moves that resolve to a verdict mid-round —
 * everything else is information the table works out at the reveal — so they
 * are the only ones that get a flash.
 */
const VERDICTS = {
  "log.stealHit": { hit: true, headline: "flash.stealHit" },
  "log.stealMissed": { hit: false, headline: "flash.stealMissed" },
  "log.doubtHit": { hit: true, headline: "flash.doubtHit" },
  "log.doubtMissed": { hit: false, headline: "flash.doubtMissed" },
} as const;

type VerdictKey = keyof typeof VERDICTS;

const isVerdictKey = (key: string): key is VerdictKey => key in VERDICTS;

const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && (ALL_CATEGORIES as string[]).includes(value);

interface Flash {
  /** Distinguishes consecutive verdicts so the animation restarts. */
  id: string;
  key: VerdictKey;
  player: string;
  target: string;
  city: string;
  category: Category | null;
  leaving: boolean;
}

const HOLD_MS = 2600;
const FADE_MS = 400;

/**
 * A verdict card that pops over the board when a call or a doubt resolves.
 *
 * It is driven by the shared log rather than by the acting player's own
 * dispatch, so everyone at the table sees the same verdict at the same time —
 * including the player who was called or doubted, who has the most reason to
 * care. Before this the outcome was one line in the activity log, which on a
 * phone sits below the board entirely.
 */
const ActionFlash = ({ log }: { log: LogEntry[] }) => {
  const { t } = useLocale();
  const { play } = useSound();
  const [flash, setFlash] = useState<Flash | null>(null);

  // The newest entry already seen. Seeded on the first render so that joining
  // a room — or reconnecting, which delivers the whole log at once — does not
  // replay a verdict from before the player arrived.
  const seenId = useRef<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    const newest = log[0];
    if (!newest) return;

    if (!seeded.current) {
      seeded.current = true;
      seenId.current = newest.id;
      return;
    }
    if (newest.id === seenId.current) return;
    seenId.current = newest.id;

    if (!isVerdictKey(newest.key)) return;

    const params = newest.params ?? {};
    setFlash({
      id: newest.id,
      key: newest.key,
      player: String(params.player ?? ""),
      target: String(params.target ?? ""),
      city: String(params.city ?? ""),
      category: isCategory(params.category) ? params.category : null,
      leaving: false,
    });
    play(VERDICTS[newest.key].hit ? "chime" : "buzz");
  }, [log, play]);

  // Fade out on a timer, then unmount. The effect keys off the id alone, not
  // the whole flash: setting `leaving` produces a new object, and depending on
  // that would re-run the effect, whose cleanup would cancel the very timer
  // due to unmount the card — leaving an invisible live region on the page for
  // good. A new verdict has a new id, which is what should restart the clock.
  const flashId = flash?.id ?? null;
  useEffect(() => {
    if (!flashId) return;
    const fade = window.setTimeout(
      () => setFlash((current) => (current && current.id === flashId ? { ...current, leaving: true } : current)),
      HOLD_MS,
    );
    const drop = window.setTimeout(
      () => setFlash((current) => (current && current.id === flashId ? null : current)),
      HOLD_MS + FADE_MS,
    );
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(drop);
    };
  }, [flashId]);

  if (!flash) return null;

  const { hit, headline } = VERDICTS[flash.key];

  return (
    // A quarter down the viewport: clear of the app header above and the
    // action bar below, over the board itself where the eye already is.
    // Click-through, because a verdict must never eat the tap that follows it.
    <div
      className="pointer-events-none fixed inset-x-0 top-1/4 z-[60] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      {/* The shake lives on the wrapper so it composes with the card's `pop`
          instead of fighting it for the transform. */}
      <div key={flash.id} className={cx(!hit && "animate-verdict-shake")}>
        <div
          className={cx(
            "animate-pop rounded-2xl border-2 px-6 py-4 text-center shadow-2xl shadow-black/60 transition-opacity",
            hit
              ? "border-signal-500 bg-signal-500/25 text-signal-400"
              : "border-alert-500 bg-alert-500/25 text-alert-500",
            flash.leaving && "opacity-0",
          )}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        >
          <div className="flex items-center justify-center gap-2 font-display text-xl font-bold">
            {flash.category && (
              <span aria-hidden className="text-2xl">
                {categoryIcons[flash.category]}
              </span>
            )}
            {t(headline)}
          </div>
          <div className="mt-1.5 text-sm font-medium text-chart-100">
            {t("flash.body", {
              player: flash.player,
              target: flash.target,
              city: flash.city,
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionFlash;
