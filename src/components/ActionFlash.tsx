import { useEffect, useRef, useState } from "react";
import { LogEntry } from "../../game/logic";
import { ALL_CATEGORIES, Category } from "../../game/cities";
import { useLocale } from "@/i18n";
import { useSound } from "@/hooks/useSound";
import { EmojiText } from "@/components/Emoji";
import { CategoryIcon } from "./Glyph";
import StageCall, { STAGE_FADE_MS } from "./StageCall";

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

/**
 * A verdict card that pops over the board when a call or a doubt resolves.
 *
 * It is driven by the shared log rather than by the acting player's own
 * dispatch, so everyone at the table sees the same verdict at the same time —
 * including the player who was called or doubted, who has the most reason to
 * care. Before this the outcome was one line in the activity log, which on a
 * phone sits below the board entirely.
 */
const ActionFlash = ({
  log,
  onActive,
}: {
  log: LogEntry[];
  /**
   * Whether a verdict is on screen, fade included. The board holds its turn
   * call back while one is: both are `StageCall` flashes in the same place, so
   * without this they land on top of each other — and a doubt resolving is
   * exactly the moment a turn is most likely to pass.
   */
  onActive?: (active: boolean) => void;
}) => {
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
      HOLD_MS + STAGE_FADE_MS,
    );
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(drop);
    };
  }, [flashId]);

  useEffect(() => {
    onActive?.(!!flash);
  }, [flash, onActive]);

  if (!flash) return null;

  const { hit, headline } = VERDICTS[flash.key];

  // Keyed on the verdict so a second one restarts the entrance rather than
  // sliding new words into the card already on screen.
  return (
    <StageCall
      key={flash.id}
      mode="flash"
      tone={hit ? "signal" : "alert"}
      shake={!hit}
      leaving={flash.leaving}
      icon={flash.category ? <CategoryIcon category={flash.category} className="text-2xl" /> : null}
      title={t(headline)}
      prompt={
        <span className="text-sm font-medium text-chart-100">
          <EmojiText
            text={t("flash.body", {
              player: flash.player,
              target: flash.target,
              city: flash.city,
            })}
          />
        </span>
      }
    />
  );
};

export default ActionFlash;
