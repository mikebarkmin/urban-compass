/**
 * A player's editable avatar. Stored on the `User` so it travels with them
 * from the lobby through to the game-over screen and is the same for everyone
 * in the room.
 */
export interface AvatarConfig {
  /** Background hue, 0–359. Drawn at a fixed saturation/lightness for contrast. */
  hue: number;
  /** A single emoji rendered on the puck. */
  symbol: string;
}

/**
 * Curated hues, spread around the wheel and nudged away from the muddy
 * yellow-green band so neighbouring swatches stay distinguishable.
 */
export const AVATAR_HUES = [
  0, 18, 35, 50, 95, 140, 165, 185, 205, 225, 255, 280, 305, 330,
] as const;

/**
 * The emoji offered as avatar symbols. Animals and creatures only — they are
 * distinctive silhouettes. Each is shipped as a self-hosted Twemoji SVG (see
 * `public/emoji/` and `src/utils/emoji.ts`) so the puck renders identically on
 * every OS instead of depending on the system emoji font.
 */
export const AVATAR_SYMBOLS = [
  "🦊", "🐻", "🦉", "🐧", "🦄", "🐙", "🦋", "🐝",
  "🦖", "🐠", "🦈", "🐬", "🦅", "🐺", "🦝", "🐰",
  "🐱", "🐶", "🦁", "🐯", "🐸", "🐵", "🦓", "🐘",
  "🦏", "🐢", "🦩", "🦚", "🐳", "🦢", "🦜", "🦥",
] as const;

const clampHue = (hue: number) => Math.max(0, Math.min(360, Math.round(hue)));

/**
 * The lowercase hex codepoint sequence for an emoji, e.g. "🦊" → "1f98a",
 * "🇪🇺" → "1f1ea-1f1fa". This is the filename of its self-hosted SVG in
 * `public/emoji/`. The variation selector U+FE0F is dropped because Twemoji
 * names its files without it.
 */
export const emojiCodepoint = (symbol: string): string =>
  [...symbol]
    .map((cp) => cp.codePointAt(0)?.toString(16) ?? "")
    .filter((cp) => cp && cp !== "fe0f")
    .join("-");

/** Build a valid avatar from untrusted client input, falling back to a random one. */
export const sanitizeAvatar = (input: unknown): AvatarConfig => {
  const fallback = randomAvatar();
  if (!input || typeof input !== "object") return fallback;
  const { hue, symbol } = input as Record<string, unknown>;

  const safeHue =
    typeof hue === "number" && Number.isFinite(hue) ? clampHue(hue) : fallback.hue;
  const safeSymbol =
    typeof symbol === "string" &&
    (AVATAR_SYMBOLS as readonly string[]).includes(symbol)
      ? symbol
      : fallback.symbol;

  return { hue: safeHue, symbol: safeSymbol };
};

export const randomAvatar = (): AvatarConfig => ({
  hue: AVATAR_HUES[Math.floor(Math.random() * AVATAR_HUES.length)],
  symbol: AVATAR_SYMBOLS[Math.floor(Math.random() * AVATAR_SYMBOLS.length)],
});

/** The background colour for a hue, matching the readability of `stringToColor`. */
export const avatarColor = (hue: number) => `hsl(${clampHue(hue)}, 66%, 64%)`;
