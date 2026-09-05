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
export const loadCities = (onProgress?: (megabytesRead: number) => void): Promise<City[]> => {
  if (cached) return cached;

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  cached = fetch(`${base}/cities5000.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`cities5000: ${response.status}`);
      if (!onProgress || !response.body) return response.json() as Promise<CompactCity[]>;

      // Roughly 1.6 MB over the wire and 4.2 MB decoded — on a phone
      // connection that is long enough to look like a hang, so read the body
      // in chunks and report how far it has got. `content-length` counts
      // compressed bytes while the stream yields decoded ones, so the two
      // cannot be turned into a percentage; the running total is the honest
      // number to show.
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let read = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        read += value.length;
        onProgress(read / 1_048_576);
      }

      const merged = new Uint8Array(read);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      return JSON.parse(new TextDecoder().decode(merged)) as CompactCity[];
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
