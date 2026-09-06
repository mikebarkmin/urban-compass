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
  /** Draw names next to the dots. Off for dense pools. */
  labels?: boolean;
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

/**
 * A dependency-free scatter of cities on an equirectangular projection, scaled
 * to whatever the given cities span. It is only ever shown once a round is
 * over — during play it would hand out every answer.
 */
const MiniMap = ({
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
  const activeHighlights = useMemo(() => {
    if (!revealedCategories) return highlights;
    const revealed = new Set(revealedCategories);
    const map: Record<string, Category[]> = {};
    for (const [cityId, cats] of Object.entries(highlights)) {
      const kept = cats.filter((c) => revealed.has(c));
      if (kept.length > 0) map[cityId] = kept;
    }
    return map;
  }, [highlights, revealedCategories]);

  const plotted = useMemo(() => {
    const points = cities.filter(
      (city): city is Plottable & { latitude: number; longitude: number } =>
        typeof city.latitude === "number" && typeof city.longitude === "number",
    );
    if (points.length === 0) return null;

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

    // Fit into a 100x100 box while keeping the aspect ratio honest.
    const scale = 100 / Math.max(spanX, spanY);
    const offsetX = (100 - spanX * scale) / 2;
    const offsetY = (100 - spanY * scale) / 2;

    const placed = points.map((city) => ({
      ...city,
      x: offsetX + (city.longitude - minLon) * squeeze * scale,
      // SVG y grows downwards, north is up.
      y: offsetY + (maxLat - city.latitude) * scale,
    }));

    // Dot radius scales with population, area-proportional (r ∝ √pop) so a
    // city of 4M reads about twice the radius of one of 1M rather than four
    // thousand times. Falls back to a flat size when the set carries no
    // population or every city shares one.
    const pops = placed
      .map((p) => p.population)
      .filter((p): p is number => typeof p === "number" && p > 0);
    const minPop = pops.length > 0 ? Math.min(...pops) : 0;
    const maxPop = pops.length > 0 ? Math.max(...pops) : 0;
    const R_MIN = 0.9;
    const R_MAX = 3.8;
    const span = Math.sqrt(maxPop) - Math.sqrt(minPop);
    const radiusFor = (population: number | null | undefined): number => {
      if (typeof population !== "number" || population <= 0 || span === 0) {
        return (R_MIN + R_MAX) / 2;
      }
      const t = (Math.sqrt(population) - Math.sqrt(minPop)) / span;
      return R_MIN + (R_MAX - R_MIN) * t;
    };

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

    const withRadius = placed.map((city) => ({ ...city, r: radiusFor(city.population) }));
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

export default MiniMap;
