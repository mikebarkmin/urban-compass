import { useMemo } from "react";
import { City, PublicCity, Category, categoryIcons, cityName } from "../../game/cities";
import { useLocale } from "@/i18n";
import { cx } from "./ui";

type Plottable = Pick<City | PublicCity, "id" | "name" | "latitude" | "longitude"> & {
  nameDe?: string;
};

interface MiniMapProps {
  cities: Plottable[];
  /** cityId -> the categories that city is the answer to. */
  highlights?: Record<string, Category[]>;
  /** Draw names next to the dots. Off for dense pools. */
  labels?: boolean;
  className?: string;
  height?: number;
}

/**
 * A dependency-free scatter of cities on an equirectangular projection, scaled
 * to whatever the given cities span. It is only ever shown once a round is
 * over — during play it would hand out every answer.
 */
const MiniMap = ({
  cities,
  highlights = {},
  labels = true,
  className,
  height = 260,
}: MiniMapProps) => {
  const { locale, t } = useLocale();
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

    const answers = placed.filter((city) => (highlights[city.id] ?? []).length > 0);
    const rest = placed.filter((city) => (highlights[city.id] ?? []).length === 0);
    const labelled = new Set<string>();
    for (const city of answers) if (claim(city, 3.6)) labelled.add(city.id);
    for (const city of rest) if (claim(city, 3)) labelled.add(city.id);

    return { points: placed, labelled };
  }, [cities, highlights, locale]);

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
          const categories = highlights[city.id] ?? [];
          const isAnswer = categories.length > 0;

          return (
            <g key={city.id} className="animate-appear">
              {isAnswer && (
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={4.2}
                  className="fill-beacon-500/25 stroke-beacon-500/60"
                  strokeWidth={0.5}
                />
              )}
              <circle
                cx={city.x}
                cy={city.y}
                r={isAnswer ? 1.9 : 1.2}
                className={isAnswer ? "fill-beacon-400" : "fill-chart-400"}
              />
              {labels && plotted.labelled.has(city.id) && (
                <text
                  x={city.x}
                  y={city.y - 3}
                  textAnchor="middle"
                  className={cx(
                    "font-display",
                    isAnswer ? "fill-beacon-300" : "fill-chart-300",
                  )}
                  style={{ fontSize: isAnswer ? 3.6 : 3 }}
                >
                  {cityName(city, locale)}
                </text>
              )}
              {isAnswer && (
                <text
                  x={city.x}
                  y={city.y + 6.5}
                  textAnchor="middle"
                  className="fill-beacon-500"
                  style={{ fontSize: 4 }}
                >
                  {categories.map((category) => categoryIcons[category]).join(" ")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default MiniMap;
