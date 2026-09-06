import { Category } from "../../game/cities";

/**
 * The typographic symbols the interface draws: card faces, inline arrows and
 * the copied checkmark. They used to be Unicode characters, which meant the
 * shape depended on whatever font the reader's OS picked for them — the double
 * arrows and the geometric shapes are missing from common fonts and fall back
 * to an empty box, and a card that renders as a box is unplayable. Drawing
 * them as SVG paths makes them identical everywhere, the same way the emoji
 * are served from self-hosted Twemoji SVGs (see `Emoji.tsx`).
 *
 * Every path is designed in a 24×24 box and filled with `currentColor`, so a
 * glyph takes the colour of the text around it and scales with it.
 */
export type GlyphName =
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "chevrons-up"
  | "chevrons-down"
  | "triangle-up"
  | "triangle-down"
  | "square-filled"
  | "square-outline"
  | "check"
  | "cross"
  | "clock"
  | "compass"
  | "card-play"
  | "target"
  | "question"
  | "swap"
  | "pause";

/**
 * The path data for each glyph, in the shared 24×24 box. A `stroke` width
 * means the path is drawn as a line rather than filled.
 */
const GLYPH_PATHS: Record<GlyphName, { d: string; stroke?: number }> = {
  // Arrows: a shaft with a solid head, one outline so they scale cleanly.
  "arrow-up": { d: "M12 2 20 11h-5v11H9V11H4z" },
  "arrow-down": { d: "M12 22 4 13h5V2h6v11h5z" },
  "arrow-left": { d: "M2 12 11 4v5h11v6H11v5z" },
  "arrow-right": { d: "M22 12 13 20v-5H2V9h11V4z" },
  // Doubled chevrons for the altitude pair, which reads as "further than".
  "chevrons-up": { d: "M12 2l9 9h-4.6L12 6.4 7.6 11H3zm0 11l9 9h-4.6L12 17.4 7.6 22H3z" },
  "chevrons-down": { d: "M12 22l-9-9h4.6L12 17.6 16.4 13H21zm0-11L3 2h4.6L12 6.6 16.4 2H21z" },
  // Solid triangles for the population pair: distinct from the arrows at a
  // glance, which matters when both are in the same hand.
  "triangle-up": { d: "M12 3 22 20H2z" },
  "triangle-down": { d: "M12 21 2 4h20z" },
  "square-filled": { d: "M3 3h18v18H3z" },
  "square-outline": { d: "M3 3h18v18H3zm3 3v12h12V6z" },
  "check": { d: "M9.6 18.4 3.4 12.2l2.5-2.5 3.7 3.7 8.5-8.5 2.5 2.5z" },
  cross: {
    d: "M6.4 4.3 12 9.9l5.6-5.6 2.1 2.1L14.1 12l5.6 5.6-2.1 2.1L12 14.1l-5.6 5.6-2.1-2.1L9.9 12 4.3 6.4z",
  },
  // A quartered clock face, for the reveal drumroll.
  clock: {
    d: "M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21m0 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15M12 6.5a5.5 5.5 0 0 1 5.5 5.5H12z",
  },
  // --- Turn actions. Not characters at all, so there is nothing to fall back
  // to: these only ever existed as drawings.
  // A card with a chip on it: place one of yours.
  "card-play": { d: "M5 3h14v18H5zm2 2v14h10V5zm5 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6" },
  // A bullseye: call a bet by naming exactly what it was.
  target: {
    d: "M22.5 12a10.5 10.5 0 1 0-21 0 10.5 10.5 0 1 0 21 0M20 12a8 8 0 1 0-16 0 8 8 0 1 0 16 0M15.5 12a3.5 3.5 0 1 0-7 0 3.5 3.5 0 1 0 7 0",
  },
  // A question mark, for a doubt. The dot is a zero-length subpath, which a
  // round line cap paints as a disc.
  question: {
    d: "M9 9.2a3.1 3.1 0 1 1 4.3 2.9c-1 .4-1.3 1.1-1.3 2v.6M12 18.2h0",
    stroke: 1.9,
  },
  // Two arrows passing each other: move a chip somewhere else.
  swap: { d: "M4.5 9.5h12l-3.2-3.2M19.5 14.5h-12l3.2 3.2", stroke: 1.8 },
  // Pause bars: sit the rest of the round out.
  pause: { d: "M7.5 4h3.5v16H7.5zM13 4h3.5v16H13z" },
  // The wordmark, U+2316. `public/icon.svg` draws the same figure for the
  // same reason: barely any font ships that codepoint.
  compass: {
    d: "M16.31 12a4.31 4.31 0 1 1-8.62 0 4.31 4.31 0 0 1 8.62 0M12 3.56v3.38M12 17.06v3.38M3.56 12h3.38M17.06 12h3.38",
    stroke: 1.22,
  },
};

/**
 * The glyph a card shows. Kept alongside the categories rather than in
 * `game/cities.ts` so the shared game code stays free of anything about how
 * the client draws.
 */
export const CATEGORY_GLYPHS: Record<Category, GlyphName> = {
  northernmost: "arrow-up",
  southernmost: "arrow-down",
  easternmost: "arrow-right",
  westernmost: "arrow-left",
  most_population: "triangle-up",
  least_population: "triangle-down",
  highest: "chevrons-up",
  lowest: "chevrons-down",
  largest_area: "square-filled",
  smallest_area: "square-outline",
};

/** The characters `EmojiText` swaps for a drawn glyph. */
export const GLYPH_FOR_CHAR: Record<string, GlyphName> = {
  "↑": "arrow-up",
  "↓": "arrow-down",
  "←": "arrow-left",
  "→": "arrow-right",
  "⇧": "chevrons-up",
  "⇩": "chevrons-down",
  "▲": "triangle-up",
  "▼": "triangle-down",
  "■": "square-filled",
  "□": "square-outline",
  "✓": "check",
  "✗": "cross",
  "◴": "clock",
  "⌖": "compass",
};

/**
 * The bare path element, for callers that already have an `<svg>` open — the
 * minimap draws its card glyphs inside the map itself. It carries no fill of
 * its own, so it inherits whatever the surrounding `<svg>` or `<g>` sets.
 */
export const GlyphPath = ({ name }: { name: GlyphName }) => {
  const { d, stroke } = GLYPH_PATHS[name];
  return stroke ? (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ) : (
    <path d={d} fillRule="evenodd" />
  );
};

/**
 * A drawn symbol, sized like a letter of the surrounding text unless the
 * caller says otherwise. Decorative by default: every glyph in the app sits
 * next to the label it stands for, so a screen reader should skip it.
 */
export const Glyph = ({
  name,
  label,
  className,
  style,
}: {
  name: GlyphName;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="currentColor"
    className={className}
    style={{ display: "inline-block", verticalAlign: "-0.125em", ...style }}
    role={label ? "img" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    <GlyphPath name={name} />
  </svg>
);

/** The glyph on a category's card. */
export const CategoryIcon = ({
  category,
  className,
  style,
}: {
  category: Category;
  className?: string;
  style?: React.CSSProperties;
}) => <Glyph name={CATEGORY_GLYPHS[category]} className={className} style={style} />;

export default Glyph;
