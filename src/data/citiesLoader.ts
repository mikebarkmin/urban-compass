// Lazy loader for the compact geonames dataset the city-set builder filters in
// the browser. The file is fetched once per session and parsed into `City[]`.

import { City } from "../../game/cities";

/**
 * A compact row from `public/cities5000.json`, in column order:
 * [geonameid, countryCode, latitude, longitude, population, elevation, name, nameDe]
 */
type CompactCity = [
  string,
  string | null,
  number,
  number,
  number,
  number | null,
  string,
  string | null,
];

const toCity = (row: CompactCity): City => ({
  id: row[0],
  ...(row[1] ? { country: row[1] } : {}),
  latitude: row[2],
  longitude: row[3],
  population: row[4],
  ...(row[5] !== null ? { elevation: row[5] } : {}),
  name: row[6],
  ...(row[7] ? { nameDe: row[7] } : {}),
});

let cached: Promise<City[]> | null = null;

/**
 * Fetch and parse the compact dataset, caching the result so the dataset is
 * downloaded only once per session. Resolves with an empty array if the fetch
 * fails — the builder shows an error rather than crashing.
 */
export const loadCities = (): Promise<City[]> => {
  if (cached) return cached;

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  cached = fetch(`${base}/cities5000.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`cities5000: ${response.status}`);
      return response.json() as Promise<CompactCity[]>;
    })
    .then((rows) => rows.map(toCity))
    .catch((error) => {
      // Drop the cache so a later retry can try again.
      cached = null;
      console.error(error);
      return [] as City[];
    });

  return cached;
};
