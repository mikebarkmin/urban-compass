// The regions a player can point the game at: rough continent bounding boxes
// and the country codes worth a one-click chip.
//
// Both the city-set builder (which drops them into its lat/lon fields) and the
// expedition (which filters its pool with them) need these, so they live here
// rather than inside either screen.

export interface Bounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export type ContinentKey =
  | "europe"
  | "africa"
  | "asia"
  | "northAmerica"
  | "southAmerica"
  | "oceania";

/**
 * Continent bounding boxes. Rough but good enough to seed a filter the host
 * then narrows, and good enough to keep an expedition on one landmass.
 */
export const CONTINENT_BOUNDS: Record<ContinentKey, Bounds> = {
  europe: { latMin: 36, latMax: 71, lonMin: -25, lonMax: 45 },
  africa: { latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
  asia: { latMin: 5, latMax: 77, lonMin: 26, lonMax: 180 },
  northAmerica: { latMin: 14, latMax: 83, lonMin: -170, lonMax: -52 },
  southAmerica: { latMin: -56, latMax: 13, lonMin: -82, lonMax: -34 },
  oceania: { latMin: -47, latMax: 5, lonMin: 110, lonMax: 180 },
};

/** The continents, in display order. */
export const CONTINENT_KEYS = Object.keys(CONTINENT_BOUNDS) as ContinentKey[];

/** Country codes offered as one-click chips, in display order. */
export const COMMON_COUNTRIES = [
  "US", "DE", "FR", "GB", "IT", "ES", "RU", "CN", "IN", "BR",
  "JP", "CA", "AU", "MX", "NL", "PL", "TR", "ID", "EG", "AR",
  "ZA", "KR", "SE", "NO", "AT", "CH", "PT", "GR", "UA",
];

/** Whether a code is one the dictionary carries a name for. */
export const isNamedCountry = (code: string): boolean =>
  COMMON_COUNTRIES.includes(code);
