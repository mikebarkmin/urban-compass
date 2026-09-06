import { Fragment, ReactNode } from "react";
import { symbolUrl } from "@/utils/emoji";
import { GLYPH_FOR_CHAR, Glyph } from "./Glyph";

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
 * variation selector is present, so the typographic symbols in that range are
 * left to `GLYPH_RE` below rather than looked up as a Twemoji file.
 */
const EMOJI_RE =
  /[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]\uFE0F?|[\u{2600}-\u{27BF}]\uFE0F/u;

/**
 * The typographic symbols the app draws itself (see `Glyph.tsx`). Twemoji
 * ships no file for them, and the system fonts that do carry them disagree on
 * the shape — some have no glyph at all and render an empty box.
 */
const GLYPH_RE = new RegExp(`[${Object.keys(GLYPH_FOR_CHAR).join("")}]\uFE0F?`, "u");

/** Either kind of symbol, in one pass so the text between them stays intact. */
const SYMBOL_RE = new RegExp(`${EMOJI_RE.source}|${GLYPH_RE.source}`, "gu");

type Segment = { emoji: string } | { glyph: string } | { text: string };

const splitSymbols = (text: string): Segment[] => {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(SYMBOL_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    const symbol = match[0];
    const bare = symbol.replace(/\uFE0F/g, "");
    segments.push(bare in GLYPH_FOR_CHAR ? { glyph: bare } : { emoji: symbol });
    last = index + symbol.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
};

/**
 * Render a string that may contain emoji, replacing each one with its
 * self-hosted Twemoji SVG and each typographic symbol with a drawn glyph.
 * Used for translated strings, whose symbols would otherwise depend on
 * whatever fonts the reader happens to have.
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
    {splitSymbols(text).map((seg, i) =>
      "emoji" in seg ? (
        <Emoji key={i} symbol={seg.emoji} className={emojiClassName} />
      ) : "glyph" in seg ? (
        <Glyph key={i} name={GLYPH_FOR_CHAR[seg.glyph]} />
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
