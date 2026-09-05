import { useEffect, useState, type RefObject } from "react";
import { cx } from "./ui";

interface TurnClockProps {
  /** The server's deadline for the current turn, in server time. */
  endsAt: number;
  /** How long the full turn is, in seconds — the denominator for the bar. */
  totalSeconds: number;
  /** How far this machine's clock sits behind the server's. */
  clockOffset: RefObject<number>;
  /** Draw the clock as the player's own, which is worth being loud about. */
  mine?: boolean;
  /**
   * The clock is sitting on the amber turn bar rather than the dark one, so
   * it has to switch to dark ink. Without this it keeps its chart-grey
   * numerals and reads as a control borrowed from another screen.
   */
  onAccent?: boolean;
}

/**
 * A countdown for the active player's turn. It only draws the room's clock —
 * the server owns the deadline and is what actually passes the turn, so a
 * paused tab or a slow frame here cannot cost anybody their card.
 */
const TurnClock = ({ endsAt, totalSeconds, clockOffset, mine, onAccent }: TurnClockProps) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - (Date.now() + clockOffset.current)));
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [endsAt, clockOffset]);

  const seconds = Math.ceil(remaining / 1000);
  const fraction = totalSeconds > 0 ? Math.min(1, remaining / (totalSeconds * 1000)) : 0;
  const urgent = seconds <= 5 && remaining > 0;

  return (
    <div className="flex items-center gap-2" aria-live="off">
      <div
        className={cx(
          "h-1.5 w-20 overflow-hidden rounded-full",
          onAccent ? "bg-chart-950/20" : "bg-chart-800",
        )}
      >
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            onAccent
              ? urgent
                ? "bg-alert-500"
                : "bg-chart-950"
              : urgent
                ? "bg-alert-500"
                : mine
                  ? "bg-beacon-500"
                  : "bg-chart-500",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span
        className={cx(
          "w-7 text-right font-display text-sm font-bold tabular-nums",
          urgent && "animate-pulse",
          onAccent
            ? urgent
              ? "text-alert-500"
              : "text-chart-950"
            : urgent
              ? "text-alert-500"
              : "text-chart-300",
        )}
      >
        {seconds}
      </span>
    </div>
  );
};

export default TurnClock;
