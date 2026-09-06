import { Mark } from "@/utils/daily";
import { cx } from "./ui";

/** Card framing for a graded answer, used by the hand and the answer list. */
export const MARK_STYLE = {
  hit: "border-signal-500/60 bg-signal-500/10",
  close: "border-beacon-500/50 bg-beacon-500/10",
  miss: "border-chart-700 bg-chart-900/70",
} as const;

/**
 * The on-page result grid is drawn rather than typed. The 🟩🟨⬛ squares that go
 * into the shared text are missing from a fair number of emoji fonts and fall
 * back to empty boxes, which is fine in a chat app but not on the page itself.
 */
const MARK_FILL = {
  hit: "bg-signal-500",
  close: "bg-beacon-500",
  miss: "bg-chart-700",
} as const;

export const MarkSquare = ({ mark, size = 14 }: { mark: Mark; size?: number }) => (
  <span
    className={cx("inline-block shrink-0 rounded-[3px]", MARK_FILL[mark])}
    style={{ width: size, height: size }}
    aria-hidden
  />
);

export default MarkSquare;
