import { useEffect, useMemo, useRef, useState } from "react";
import { City, PublicCity, Category, cityName } from "../../game/cities";
import { CATEGORY_GLYPHS, GlyphPath } from "./Glyph";
import { useLocale } from "@/i18n";
import { cx } from "./ui";

type Plottable = Pick<City | PublicCity, "id" | "name" | "latitude" | "longitude" | "population"> & {
  nameDe?: string;
};

interface MiniMapProps {
  cities: Plottable[];
  /** cityId -> the categories that city is the answer to. */
  highlights?: Record<string, Category[]>;
  /**
   * When set, only cities whose highlight categories intersect this subset are
   * shown as answers. Used by the staged reveal to light up dots one category
   * at a time; omitted (the default) reveals everything at once.
   */
  revealedCategories?: Category[];
  /**
   * Draw names next to the dots. `true` names as many as fit beside their dot
   * and drops the rest; `"all"` names every city, pushing a crowded name out
   * to a free spot and tying it back to its dot with a leader line. Off for
   * dense pools.
   */
  labels?: boolean | "all";
  className?: string;
  height?: number;
}

/**
 * The card glyphs under an answer dot. Drawn as paths rather than set as text,
 * for the same reason the rest of the app does (see `Glyph.tsx`) — and here it
 * also means the row is laid out in map units instead of depending on how a
 * font happens to space the symbols.
 */
const CategoryGlyphRow = ({
  categories,
  x,
  y,
  size,
}: {
  categories: Category[];
  x: number;
  y: number;
  size: number;
}) => {
  const gap = size * 0.35;
  const width = categories.length * size + (categories.length - 1) * gap;
  const scale = size / 24;

  return (
    <g className="fill-beacon-500">
      {categories.map((category, index) => (
        <g
          key={category}
          transform={`translate(${x - width / 2 + index * (size + gap)} ${y}) scale(${scale})`}
        >
          <GlyphPath name={CATEGORY_GLYPHS[category]} />
        </g>
      ))}
    </g>
  );
};

type Located = Plottable & { latitude: number; longitude: number };

/** The cities that can be drawn at all: a pool may carry some without coordinates. */
const locatable = (cities: Plottable[]): Located[] =>
  cities.filter(
    (city): city is Located =>
      typeof city.latitude === "number" && typeof city.longitude === "number",
  );

/**
 * Keep only the highlight categories revealed so far. With no subset given,
 * every highlight passes through.
 */
const filterHighlights = (
  highlights: Record<string, Category[]>,
  revealedCategories?: Category[],
): Record<string, Category[]> => {
  if (!revealedCategories) return highlights;
  const revealed = new Set(revealedCategories);
  const map: Record<string, Category[]> = {};
  for (const [cityId, cats] of Object.entries(highlights)) {
    const kept = cats.filter((c) => revealed.has(c));
    if (kept.length > 0) map[cityId] = kept;
  }
  return map;
};

/**
 * Lay cities out on an equirectangular projection fitted into a `width` by
 * `height` box, keeping the aspect ratio honest and centring the slack.
 * `sizeT` maps a population onto 0–1 for the dot radius.
 */
const project = (points: Located[], width: number, height: number) => {
  const latitudes = points.map((p) => p.latitude);
  const longitudes = points.map((p) => p.longitude);
  // Longitudes are squeezed by the cosine of the mean latitude so the shape
  // does not look stretched the further north the set sits.
  const meanLatitude = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
  const squeeze = Math.max(0.25, Math.cos((meanLatitude * Math.PI) / 180));

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  const spanX = Math.max((maxLon - minLon) * squeeze, 0.5);
  const spanY = Math.max(maxLat - minLat, 0.5);

  const scale = Math.min(width / spanX, height / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const placed = points.map((city) => ({
    ...city,
    x: offsetX + (city.longitude - minLon) * squeeze * scale,
    // SVG y grows downwards, north is up.
    y: offsetY + (maxLat - city.latitude) * scale,
  }));

  // Dot radius scales with population, area-proportional (r ∝ √pop) so a
  // city of 4M reads about twice the radius of one of 1M rather than four
  // thousand times. Falls back to the middle size when the set carries no
  // population or every city shares one.
  const pops = placed
    .map((p) => p.population)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const minPop = pops.length > 0 ? Math.min(...pops) : 0;
  const maxPop = pops.length > 0 ? Math.max(...pops) : 0;
  const span = Math.sqrt(maxPop) - Math.sqrt(minPop);
  const sizeT = (population: number | null | undefined): number => {
    if (typeof population !== "number" || population <= 0 || span === 0) return 0.5;
    return (Math.sqrt(population) - Math.sqrt(minPop)) / span;
  };

  return { placed, sizeT };
};

/** Track an element's content width in pixels. */
const useBoxWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
};

/**
 * Measure label text in the display face. The layout needs each name's width
 * before anything is drawn, and a per-character guess is far enough off for
 * Space Grotesk that neighbouring names end up touching. Falls back to that
 * guess where there is no canvas.
 */
let measureContext: CanvasRenderingContext2D | null | undefined;
const measureText = (text: string, fontSize: number, family: string): number => {
  if (measureContext === undefined) {
    measureContext =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  if (!measureContext || !family) return text.length * fontSize * 0.56;
  measureContext.font = `600 ${fontSize}px ${family}`;
  return measureContext.measureText(text).width;
};

/**
 * The font family labels are drawn in, read off a probe rather than the
 * `--font-display` variable: the variable's own inner reference may not be
 * defined at this point in the tree, and the probe reports what really renders.
 */
const displayFamily = (host: HTMLElement): string => {
  const probe = document.createElement("span");
  probe.className = "font-display";
  host.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family;
};

type Box = { x0: number; y0: number; x1: number; y1: number };

const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Whether the segment p–q passes through the box (Liang–Barsky clip). */
const segmentHitsBox = (px: number, py: number, qx: number, qy: number, box: Box) => {
  const dx = qx - px;
  const dy = qy - py;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, px - box.x0],
    [dx, box.x1 - px],
    [-dy, py - box.y0],
    [dy, box.y1 - py],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
};

const LEADER_FONT = { answer: 13, rest: 11 };
const LEADER_GLYPH = 12;
const LEADER_GLYPH_GAP = 3;
const LEADER_R = { min: 2.5, max: 8 };
const MIN_LEADER_HEIGHT = 200;

/**
 * Every city named. A name first tries the spots right beside its dot; when
 * those are taken it is pushed out ring by ring until it finds room, and a
 * thin line ties it back to its dot. Answers go first so they get the closest
 * spots, then the most crowded cities, which have the fewest options.
 */
const LeaderMap = ({
  cities,
  highlights = {},
  revealedCategories,
  className,
  height = 260,
}: MiniMapProps) => {
  const { locale } = useLocale();
  const [boxRef, width] = useBoxWidth();

  const activeHighlights = useMemo(
    () => filterHighlights(highlights, revealedCategories),
    [highlights, revealedCategories],
  );

  const layout = useMemo(() => {
    const points = locatable(cities);
    if (points.length === 0 || width === 0) return null;

    const family = boxRef.current ? displayFamily(boxRef.current) : "";

    // Leave a margin for the names of the outermost cities; the rest of the
    // box is the plot, whatever its shape.
    const padX = Math.min(90, Math.max(36, width * 0.14));
    const padY = 30;
    // The prop counts the 1px border; the plot lives inside it.
    const maxHeight = height - 2;
    const fitted = project(points, width - padX * 2, maxHeight - padY * 2);
    const { sizeT } = fitted;

    // `height` is a ceiling, not a size: a set strung out along a parallel
    // would otherwise sit in a thin band across an empty box. Shrink to the
    // cities' own extent, keeping enough room for a name above and below.
    const ys = fitted.placed.map((city) => city.y);
    const extent = Math.max(...ys) - Math.min(...ys);
    const boxHeight = Math.min(maxHeight, Math.max(MIN_LEADER_HEIGHT, extent + padY * 2));
    const shiftY = padY - Math.min(...ys) + (boxHeight - padY * 2 - extent) / 2;
    const placed = fitted.placed.map((city) => ({ ...city, y: city.y + shiftY }));

    const dots = placed.map((city) => {
      const categories = activeHighlights[city.id] ?? [];
      const answer = categories.length > 0;
      const font = answer ? LEADER_FONT.answer : LEADER_FONT.rest;
      const name = cityName(city, locale);
      const textWidth = measureText(name, font, family);
      const glyphWidth =
        categories.length > 0
          ? LEADER_GLYPH_GAP * 2 + categories.length * LEADER_GLYPH + (categories.length - 1) * 2
          : 0;
      return {
        ...city,
        x: city.x + padX,
        y: city.y,
        r: LEADER_R.min + (LEADER_R.max - LEADER_R.min) * sizeT(city.population),
        categories,
        answer,
        font,
        name,
        textWidth,
        w: textWidth + glyphWidth,
        h: Math.max(font, answer ? LEADER_GLYPH : 0) + 2,
      };
    });

    // A dot's footprint includes the answer halo around it.
    const dotBoxes = dots.map((dot) => {
      const reach = dot.r + (dot.answer ? 4 : 1.5);
      return { x0: dot.x - reach, y0: dot.y - reach, x1: dot.x + reach, y1: dot.y + reach };
    });

    const crowding = (dot: (typeof dots)[number]) =>
      dots.filter(
        (other) => other !== dot && Math.hypot(other.x - dot.x, other.y - dot.y) < 60,
      ).length;
    const order = [...dots].sort(
      (a, b) =>
        Number(b.answer) - Number(a.answer) ||
        crowding(b) - crowding(a) ||
        (b.population ?? 0) - (a.population ?? 0),
    );

    const labelBoxes: Box[] = [];
    const leaders: Box[] = [];
    const result = new Map<string, { box: Box; leader: Box | null }>();

    // Right and left read most naturally, then above and below, then the
    // diagonals. Further rings add in-between angles to find gaps.
    const nearAngles = [0, 180, 270, 90, 315, 225, 45, 135];
    const farAngles = Array.from({ length: 16 }, (_, i) => i * 22.5);

    for (const dot of order) {
      const rings = [3, 14, 26, 40, 56, 74, 96, 120].map((d) => dot.r + d);
      let best: { box: Box; ring: number; anchor: [number, number]; penalty: number } | null =
        null;

      for (let ring = 0; ring < rings.length; ring++) {
        const angles = ring === 0 ? nearAngles : farAngles;
        for (const angle of angles) {
          const rad = (angle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const ax = dot.x + rings[ring] * cos;
          const ay = dot.y + rings[ring] * sin;
          // Grow the box away from the dot, so its near edge sits on the ring.
          const x0 = cos > 0.35 ? ax : cos < -0.35 ? ax - dot.w : ax - dot.w / 2;
          const y0 = sin > 0.35 ? ay : sin < -0.35 ? ay - dot.h : ay - dot.h / 2;
          const box = { x0, y0, x1: x0 + dot.w, y1: y0 + dot.h };

          if (box.x0 < 2 || box.y0 < 2 || box.x1 > width - 2 || box.y1 > boxHeight - 2) continue;

          // The leader runs from the dot to the nearest point on the label.
          const nx = Math.min(Math.max(dot.x, box.x0), box.x1);
          const ny = Math.min(Math.max(dot.y, box.y0), box.y1);

          let penalty = 0;
          for (const other of labelBoxes) {
            penalty += overlapArea(box, other) + (overlaps(box, other, 2) ? 50 : 0);
          }
          dotBoxes.forEach((other, i) => {
            if (dots[i] !== dot && overlaps(box, other, 2)) penalty += 40 + overlapArea(box, other);
          });
          for (const line of leaders) {
            if (segmentHitsBox(line.x0, line.y0, line.x1, line.y1, box)) penalty += 30;
          }
          if (ring > 0) {
            for (const other of labelBoxes) {
              if (segmentHitsBox(dot.x, dot.y, nx, ny, other)) penalty += 30;
            }
            dotBoxes.forEach((other, i) => {
              if (dots[i] !== dot && segmentHitsBox(dot.x, dot.y, nx, ny, other)) penalty += 20;
            });
          }

          if (penalty === 0) {
            best = { box, ring, anchor: [nx, ny], penalty };
            break;
          }
          // Keep the least-bad spot in case nothing is clear: every name gets
          // drawn, even if it has to touch something. Distance costs a little
          // so a near miss still beats a far one.
          const cost = penalty + ring * 8;
          if (!best || cost < best.penalty) best = { box, ring, anchor: [nx, ny], penalty: cost };
        }
        if (best && best.penalty === 0) break;
      }

      if (!best) {
        // Nowhere inside the frame at all — a tiny map. Centre it above.
        const x0 = Math.min(Math.max(dot.x - dot.w / 2, 2), width - 2 - dot.w);
        const y0 = Math.max(dot.y - dot.r - 3 - dot.h, 2);
        const box = { x0, y0, x1: x0 + dot.w, y1: y0 + dot.h };
        best = { box, ring: 0, anchor: [dot.x, dot.y], penalty: 0 };
      }

      labelBoxes.push(best.box);
      let leader: Box | null = null;
      const [nx, ny] = best.anchor;
      const distance = Math.hypot(nx - dot.x, ny - dot.y);
      if (best.ring > 0 && distance > dot.r + 6) {
        const ux = (nx - dot.x) / distance;
        const uy = (ny - dot.y) / distance;
        const start = dot.r + (dot.answer ? 4 : 1.5);
        leader = {
          x0: dot.x + ux * start,
          y0: dot.y + uy * start,
          x1: nx - ux * 1.5,
          y1: ny - uy * 1.5,
        };
        leaders.push(leader);
      }
      result.set(dot.id, { box: best.box, leader });
    }

    return { dots, labels: result, height: boxHeight };
  }, [cities, activeHighlights, locale, width, height, boxRef]);

  return (
    <div
      ref={boxRef}
      className={cx(
        "relative overflow-hidden rounded-xl border border-chart-700 bg-chart-950/60",
        className,
      )}
      style={{ height: layout ? layout.height + 2 : height }}
    >
      <div className="graticule absolute inset-0 opacity-40" />
      {layout && (
        <svg
          viewBox={`0 0 ${width} ${layout.height}`}
          className="relative h-full w-full"
          role="img"
          aria-label={`Map of ${layout.dots.length} cities`}
        >
          {/* Leaders underneath everything, so a dot or name is never struck through. */}
          <g className="stroke-chart-500" strokeWidth={0.75}>
            {layout.dots.map((dot) => {
              const leader = layout.labels.get(dot.id)?.leader;
              if (!leader) return null;
              return (
                <line
                  key={dot.id}
                  x1={leader.x0}
                  y1={leader.y0}
                  x2={leader.x1}
                  y2={leader.y1}
                  className={dot.answer ? "stroke-beacon-500/70" : undefined}
                />
              );
            })}
          </g>

          {layout.dots.map((dot) => (
            <g key={dot.id} className="animate-appear">
              {dot.answer && (
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.r + 4}
                  className="fill-beacon-500/25 stroke-beacon-500/60"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                className={dot.answer ? "fill-beacon-400" : "fill-chart-400"}
              />
            </g>
          ))}

          {layout.dots.map((dot) => {
            const label = layout.labels.get(dot.id);
            if (!label) return null;
            const { box } = label;
            const baseline = box.y0 + (box.y1 - box.y0) / 2 + dot.font * 0.36;
            return (
              <g key={dot.id} className="animate-appear">
                <text
                  x={box.x0}
                  y={baseline}
                  className={cx(
                    "stroke-chart-950 font-display font-semibold",
                    dot.answer ? "fill-beacon-300" : "fill-chart-200",
                  )}
                  style={{
                    fontSize: dot.font,
                    paintOrder: "stroke",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {dot.name}
                </text>
                {dot.categories.length > 0 && (
                  <g className="fill-beacon-500 text-beacon-500">
                    {dot.categories.map((category, index) => {
                      const gx =
                        box.x0 + dot.textWidth + LEADER_GLYPH_GAP * 2 + index * (LEADER_GLYPH + 2);
                      const gy = box.y0 + (box.y1 - box.y0 - LEADER_GLYPH) / 2;
                      return (
                        <g
                          key={category}
                          transform={`translate(${gx} ${gy}) scale(${LEADER_GLYPH / 24})`}
                        >
                          <GlyphPath name={CATEGORY_GLYPHS[category]} />
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

/**
 * A dependency-free scatter of cities on an equirectangular projection, scaled
 * to whatever the given cities span. It is only ever shown once a round is
 * over — during play it would hand out every answer.
 */
const ScatterMap = ({
  cities,
  highlights = {},
  revealedCategories,
  labels = true,
  className,
  height = 260,
}: MiniMapProps) => {
  const { locale, t } = useLocale();

  // The viewBox is a fixed 128 units wide, so a font size given in those units
  // renders smaller the narrower the map gets — on a phone the labels came out
  // around 9px. Measure the box and solve for the unit size that lands on a
  // legible pixel size instead. Bigger labels collide more, and the greedy
  // layout below drops the losers: a few readable names beat a dozen unreadable
  // ones.
  const boxRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);

  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setWidthPx(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Fall back to the old sizes until the first measurement lands.
  const unitsPerPx = widthPx > 0 ? 128 / widthPx : 0;
  const answerFont = unitsPerPx > 0 ? Math.max(3.6, 12 * unitsPerPx) : 3.6;
  const restFont = unitsPerPx > 0 ? Math.max(3, 10 * unitsPerPx) : 3;

  // Filter highlights to only the categories that have been revealed so far.
  // When `revealedCategories` is undefined, all highlights pass through.
  const activeHighlights = useMemo(
    () => filterHighlights(highlights, revealedCategories),
    [highlights, revealedCategories],
  );

  const plotted = useMemo(() => {
    const points = locatable(cities);
    if (points.length === 0) return null;

    const { placed, sizeT } = project(points, 100, 100);
    const R_MIN = 0.9;
    const R_MAX = 3.8;
    const radiusFor = (city: Plottable) => R_MIN + (R_MAX - R_MIN) * sizeT(city.population);

    // Dense pools stack cities on top of each other, so labels are laid out
    // greedily: answers claim their box first, and any other name that would
    // collide with an already-placed one is dropped rather than overprinted.
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const claim = (city: (typeof placed)[number], fontSize: number) => {
      const halfWidth = (cityName(city, locale).length * fontSize * 0.52) / 2;
      const box = {
        x0: city.x - halfWidth,
        x1: city.x + halfWidth,
        y0: city.y - 3 - fontSize,
        y1: city.y - 2,
      };
      const collides = boxes.some(
        (other) => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0,
      );
      if (collides) return false;
      boxes.push(box);
      return true;
    };

    const answers = placed.filter((city) => (activeHighlights[city.id] ?? []).length > 0);
    const rest = placed.filter((city) => (activeHighlights[city.id] ?? []).length === 0);
    const labelled = new Set<string>();
    for (const city of answers) if (claim(city, answerFont)) labelled.add(city.id);
    for (const city of rest) if (claim(city, restFont)) labelled.add(city.id);

    const withRadius = placed.map((city) => ({ ...city, r: radiusFor(city) }));
    return { points: withRadius, labelled };
  }, [cities, activeHighlights, locale, answerFont, restFont]);

  if (!plotted) {
    return (
      <div
        className={cx(
          "grid place-items-center rounded-xl border border-chart-700 bg-chart-950/60 text-xs text-chart-500",
          className,
        )}
        style={{ height }}
      >
        {t("results.map.hidden")}
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className={cx(
        "relative overflow-hidden rounded-xl border border-chart-700 bg-chart-950/60",
        className,
      )}
      style={{ height }}
    >
      <div className="graticule absolute inset-0 opacity-40" />
      <svg viewBox="-14 -8 128 116" className="relative h-full w-full" role="img"
        aria-label={`Map of ${plotted.points.length} cities`}>
        {plotted.points.map((city) => {
          const categories = activeHighlights[city.id] ?? [];
          const isAnswer = categories.length > 0;

          return (
            <g key={city.id} className="animate-appear">
              {isAnswer && (
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={city.r + 2.4}
                  className="fill-beacon-500/25 stroke-beacon-500/60"
                  strokeWidth={0.5}
                />
              )}
              <circle
                cx={city.x}
                cy={city.y}
                r={city.r}
                className={isAnswer ? "fill-beacon-400" : "fill-chart-400"}
              />
              {labels && plotted.labelled.has(city.id) && (
                <text
                  x={city.x}
                  y={city.y - city.r - 1.5}
                  textAnchor="middle"
                  className={cx(
                    "font-display",
                    isAnswer ? "fill-beacon-300" : "fill-chart-300",
                  )}
                  style={{ fontSize: isAnswer ? answerFont : restFont }}
                >
                  {cityName(city, locale)}
                </text>
              )}
              {isAnswer && (
                <CategoryGlyphRow
                  categories={categories}
                  x={city.x}
                  y={city.y + city.r + 3}
                  size={Math.max(4, answerFont * 1.1)}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * A dependency-free map of cities. It is only ever shown once a round is over —
 * during play it would hand out every answer.
 */
const MiniMap = (props: MiniMapProps) =>
  props.labels === "all" ? <LeaderMap {...props} /> : <ScatterMap {...props} />;

export default MiniMap;
