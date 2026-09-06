import { ReactNode } from "react";
import { Category } from "../../game/cities";
import { CategoryIcon } from "./Glyph";
import { MARK_STYLE } from "./MarkSquare";
import { cx } from "./ui";

/**
 * How a card in hand is doing. The tone carries the whole surface — border,
 * fill, lift and the colour of the glyph — so the board and the daily read the
 * same even though they track different things.
 */
export type CardTone =
  | "idle"
  | "selected"
  | "placed"
  | "filled"
  | "muted"
  | "hit"
  | "close"
  | "miss";

const TONES: Record<CardTone, { surface: string; accent: string; ring: string }> = {
  idle: {
    surface: "border-chart-600 bg-chart-850",
    accent: "text-chart-300",
    ring: "ring-chart-600/70",
  },
  selected: {
    surface: "-translate-y-1 border-beacon-500 bg-beacon-500/15 shadow-lg shadow-beacon-500/20",
    accent: "text-beacon-400",
    ring: "ring-beacon-500/50",
  },
  placed: {
    surface: "border-signal-500/40 bg-signal-500/10",
    accent: "text-signal-400",
    ring: "ring-signal-500/40",
  },
  // A daily pick, which is only provisional: neutral, because teal is what a
  // correct answer turns once the day is revealed.
  filled: {
    surface: "border-chart-500 bg-chart-800",
    accent: "text-chart-200",
    ring: "ring-chart-500/70",
  },
  muted: {
    surface: "border-chart-800 bg-chart-900",
    accent: "text-chart-500",
    ring: "ring-chart-700",
  },
  // The graded tones share their surface with the rest of the daily's result
  // furniture, so a card and its answer panel match.
  hit: { surface: MARK_STYLE.hit, accent: "text-signal-400", ring: "ring-signal-500/40" },
  close: { surface: MARK_STYLE.close, accent: "text-beacon-400", ring: "ring-beacon-500/40" },
  miss: { surface: MARK_STYLE.miss, accent: "text-chart-500", ring: "ring-chart-700" },
};

/**
 * One card of the six in hand, drawn like a playing card rather than a button:
 * an index pip in each opposing corner, the glyph on a ring in the middle, the
 * criterion underneath, and whatever the caller puts in the footer — the city
 * it was played on, or that it has not been played yet.
 *
 * The glyph is the SVG one from `Glyph.tsx`, so a card looks the same on every
 * OS.
 */
export const CategoryCard = ({
  category,
  label,
  footer,
  tone = "idle",
  disabled,
  onClick,
  className,
}: {
  category: Category;
  label: string;
  footer?: ReactNode;
  tone?: CardTone;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) => {
  const { surface, accent, ring } = TONES[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "card-face group relative flex min-h-[7.5rem] flex-col items-center rounded-xl border px-2 pt-4 pb-5 text-center transition-all sm:w-[104px]",
        surface,
        className,
      )}
    >
      {/* The corner index, the way a suit pip sits on a playing card: the
          second one is rotated so the card reads the same either way up. */}
      <CategoryIcon
        category={category}
        className={cx("absolute top-1.5 left-1.5 h-2.5 w-2.5 opacity-60", accent)}
      />
      <CategoryIcon
        category={category}
        className={cx("absolute right-1.5 bottom-1.5 h-2.5 w-2.5 rotate-180 opacity-60", accent)}
      />

      <span
        className={cx(
          "grid h-10 w-10 place-items-center rounded-full bg-chart-950/40 ring-1 ring-inset transition-colors",
          ring,
          accent,
        )}
      >
        <CategoryIcon category={category} className="h-5 w-5" />
      </span>

      <span className="mt-2.5 block text-xs leading-tight font-medium text-chart-200">
        {label}
      </span>

      {/* Kept in the layout even when empty, so a row of cards shares one
          baseline. The card's bottom padding leaves the corner pip a band of
          its own underneath. */}
      <span className="mt-auto block min-h-[13px] w-full truncate px-1 pt-1.5 text-[10px] leading-tight">
        {footer}
      </span>
    </button>
  );
};

export default CategoryCard;
