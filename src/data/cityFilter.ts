// Filter the compact dataset down to a playable pool, by lat/lon/population
// ranges and an optional country list.

import { City, mulberry32, seedFromString } from "../../game/cities";
import { MAX_CUSTOM_CITIES } from "../../game/citySets";

export interface FilterParams {
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
  popMin?: number;
  popMax?: number;
  /** ISO-2 codes, uppercase; empty/undefined means all countries. */
  countries?: string[];
}

const fullGlobe = {
  latMin: -90,
  latMax: 90,
  lonMin: -180,
  lonMax: 180,
  popMin: 0,
  popMax: Number.POSITIVE_INFINITY,
};

/**
 * The cities matching `params`, without any cap. Exported so the builder can
 * show the true match count (and a sampling warning) before the pool is
 * trimmed.
 */
export const matchingCities = (cities: City[], params: FilterParams): City[] => {
  const {
    latMin = fullGlobe.latMin,
    latMax = fullGlobe.latMax,
    lonMin = fullGlobe.lonMin,
    lonMax = fullGlobe.lonMax,
    popMin = fullGlobe.popMin,
    popMax = fullGlobe.popMax,
    countries,
  } = params;

  const countrySet =
    countries && countries.length > 0
      ? new Set(countries.map((code) => code.toUpperCase()))
      : null;

  return cities.filter((city) => {
    if (city.latitude < latMin || city.latitude > latMax) return false;
    if (city.longitude < lonMin || city.longitude > lonMax) return false;
    if (city.population < popMin || city.population > popMax) return false;
    if (countrySet && (!city.country || !countrySet.has(city.country.toUpperCase())))
      return false;
    return true;
  });
};

/**
 * The cities matching `params`, deterministically sampled down to
 * `MAX_CUSTOM_CITIES` when the result is larger. Sampling uses a PRNG seeded
 * from the parameters, so the same filter always yields the same pool and the
 * host sees exactly what they'll get.
 */
export const filterCities = (cities: City[], params: FilterParams): City[] => {
  const matches = matchingCities(cities, params);
  if (matches.length <= MAX_CUSTOM_CITIES) return matches;

  // Fisher–Yates with a seeded PRNG so the preview is stable across re-renders.
  const random = mulberry32(seedFromString(JSON.stringify(params)));
  const shuffled = [...matches];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, MAX_CUSTOM_CITIES);
};
