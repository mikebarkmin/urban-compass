import { Fragment, ReactNode } from "react";
import { symbolUrl } from "@/utils/emoji";

/**
 * Render a single emoji from the app's self-hosted Twemoji SVGs, so it looks
 * the same on every OS instead of depending on the system emoji font.
 */
export const Emoji = ({
  symbol,
  alt,
  className,
  style,
}: {
  symbol: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={symbolUrl(symbol)}
    alt={alt ?? symbol}
    draggable={false}
    className={className}
    style={style}
  />
);

/**
 * Matches an emoji within a string: a regional-indicator pair (a flag) or a
 * single pictographic codepoint, optionally followed by the variation
 * selector U+FE0F. The dingbat range (U+2600–27BF) is only matched when the
 * variation selector is present, so a plain checkmark (U+2713, which Twemoji
 * does not ship) is left as text.
 */
const EMOJI_RE =
  /[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]\uFE0F?|[\u{2600}-\u{27BF}]\uFE0F/gu;

type Segment = { emoji: string } | { text: string };

const splitEmoji = (text: string): Segment[] => {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    segments.push({ emoji: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
};

/**
 * Render a string that may contain emoji, replacing each emoji with its
 * self-hosted Twemoji SVG. Used for translated strings whose emoji would
 * otherwise depend on the reader's OS font.
 */
export const EmojiText = ({
  text,
  className,
  emojiClassName,
}: {
  text: string;
  className?: string;
  emojiClassName?: string;
}) => (
  <span className={className}>
    {splitEmoji(text).map((seg, i) =>
      "emoji" in seg ? (
        <Emoji key={i} symbol={seg.emoji} className={emojiClassName} />
      ) : (
        <Fragment key={i}>{seg.text}</Fragment>
      ),
    )}
  </span>
);

/** Convenience for callers that already have a ReactNode of plain text. */
export const emojify = (text: string, emojiClassName?: string): ReactNode => (
  <EmojiText text={text} emojiClassName={emojiClassName} />
);
