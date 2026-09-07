// Match an unreadable placemark against the geonames dataset the builder
// already loads, so a city whose population (or name) the file left blank can
// be filled in from the dataset instead of typed in by hand.

import { City, distanceKm } from "../../game/cities";

/** How close a dataset city has to sit to be taken as the same place. */
const NEAR_KM = 25;
/** How far that stretches when the name agrees as well. */
const NAMED_KM = 75;

/** Fold a name down to the letters, so "Korfu" and "Korfu (GR)" compare equal. */
const normalise = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[^a-z0-9]/g, "");

export interface DatasetMatch {
  city: City;
  /** Kilometres between the placemark and the dataset city. */
  distance: number;
  /** Whether the names agreed, which is what widened the search radius. */
  named: boolean;
}

/**
 * The dataset city that best matches a placemark, or null when nothing is close
 * enough to be trusted.
 *
 * Coordinates are the strong signal — a placemark sitting on a dataset city is
 * that city — so the search is a radius around the point. A name that agrees
 * outranks a closer city that does not: two towns can share a valley, but only
 * one of them is the one the map names.
 */
export const matchDatasetCity = (
  dataset: City[],
  target: { name: string; latitude: number; longitude: number },
): DatasetMatch | null => {
  const wanted = normalise(target.name);

  // A cheap bounding box first: computing a great-circle distance against every
  // one of ~50k rows, for every skipped placemark, is work worth skipping.
  const latPad = NAMED_KM / 111;
  const lonPad = NAMED_KM / Math.max(1, 111 * Math.cos((target.latitude * Math.PI) / 180));

  let best: (DatasetMatch & { score: number }) | null = null;

  for (const city of dataset) {
    if (Math.abs(city.latitude - target.latitude) > latPad) continue;
    if (Math.abs(city.longitude - target.longitude) > lonPad) continue;

    const named =
      wanted !== "" &&
      (normalise(city.name) === wanted || (!!city.nameDe && normalise(city.nameDe) === wanted));

    const distance = distanceKm(city, target);
    if (distance > (named ? NAMED_KM : NEAR_KM)) continue;

    const score = distance - (named ? 1000 : 0);
    if (!best || score < best.score) best = { city, distance, named, score };
  }

  return best && { city: best.city, distance: best.distance, named: best.named };
};
