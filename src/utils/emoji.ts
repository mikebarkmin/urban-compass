import { emojiCodepoint } from "../../game/avatar";

/**
 * Resolve a symbol to its self-hosted SVG so avatars render identically on
 * every OS — no dependency on the system emoji font. The base path matches the
 * one `citiesLoader` uses, so the same URL works on GitHub Pages and locally.
 *
 * Avatar symbols used in `public/emoji/` are Twemoji (CC-BY 4.0).
 */
export const symbolUrl = (symbol: string): string => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/emoji/${emojiCodepoint(symbol)}.svg`;
};
