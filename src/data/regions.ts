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
 * Continent bounding boxes. Rough, and only ever a starting point: the city-set
 * builder drops them into its lat/lon fields for the host to narrow by hand.
 *
 * They are not what decides whether a city is in a continent — a box drawn
 * around Europe also contains Aleppo, Tel Aviv and Casablanca. Membership is
 * `CONTINENT_COUNTRIES` below.
 */
export const CONTINENT_BOUNDS: Record<ContinentKey, Bounds> = {
  europe: { latMin: 36, latMax: 71, lonMin: -25, lonMax: 45 },
  africa: { latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
  asia: { latMin: 5, latMax: 77, lonMin: 26, lonMax: 180 },
  northAmerica: { latMin: 14, latMax: 83, lonMin: -170, lonMax: -52 },
  southAmerica: { latMin: -56, latMax: 13, lonMin: -82, lonMax: -34 },
  oceania: { latMin: -47, latMax: 5, lonMin: 110, lonMax: 180 },
};

/**
 * Which countries make up each continent, as ISO-2 codes.
 *
 * Taken from the continent column of GeoNames' own countryInfo.txt, so the
 * answer to "is this city in Europe" comes from the same gazetteer as the city
 * itself. That settles the transcontinental arguments by citation rather than
 * by taste: Turkey, Cyprus, Kazakhstan, Georgia, Armenia and Azerbaijan sit
 * where GeoNames puts them, Egypt is African, and Timor-Leste is Oceanian.
 *
 * Every country code appearing in public/cities5000.json is covered. The five
 * territories GeoNames files under Antarctica are not, and belong to no
 * continent a player can pick; only two of them (South Georgia, the French
 * Southern Territories) carry a city at all.
 */
export const CONTINENT_COUNTRIES: Record<ContinentKey, string[]> = {
  europe: [
    "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CS", "CY", "CZ",
    "DE", "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR", "HR",
    "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD",
    "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI",
    "SJ", "SK", "SM", "UA", "VA", "XK",
  ],
  africa: [
    "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ",
    "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "KE",
    "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA",
    "NE", "NG", "RE", "RW", "SC", "SD", "SH", "SL", "SN", "SO", "SS", "ST",
    "SZ", "TD", "TG", "TN", "TZ", "UG", "YT", "ZA", "ZM", "ZW",
  ],
  asia: [
    "AE", "AF", "AM", "AZ", "BD", "BH", "BN", "BT", "CC", "CN", "GE", "HK",
    "ID", "IL", "IN", "IO", "IQ", "IR", "JO", "JP", "KG", "KH", "KP", "KR",
    "KW", "KZ", "LA", "LB", "LK", "MM", "MN", "MO", "MV", "MY", "NP", "OM",
    "PH", "PK", "PS", "QA", "SA", "SG", "SY", "TH", "TJ", "TM", "TR", "TW",
    "UZ", "VN", "YE",
  ],
  northAmerica: [
    "AG", "AI", "AN", "AW", "BB", "BL", "BM", "BQ", "BS", "BZ", "CA", "CR",
    "CU", "CW", "DM", "DO", "GD", "GL", "GP", "GT", "HN", "HT", "JM", "KN",
    "KY", "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PM", "PR", "SV", "SX",
    "TC", "TT", "US", "VC", "VG", "VI",
  ],
  southAmerica: [
    "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR",
    "UY", "VE",
  ],
  oceania: [
    "AS", "AU", "CK", "CX", "FJ", "FM", "GU", "KI", "MH", "MP", "NC", "NF",
    "NR", "NU", "NZ", "PF", "PG", "PN", "PW", "SB", "TK", "TL", "TO", "TV",
    "UM", "VU", "WF", "WS",
  ],
};

/**
 * The one country the list above cannot place on its own. GeoNames files all
 * of Russia under Europe, which would hand every European expedition the same
 * easternmost city — Petropavlovsk-Kamchatsky, 9,000 km past Warsaw — and
 * flatten the compass cards the mode is built on. So Europe is additionally
 * cut at the Urals.
 *
 * The window is wide enough to leave every other European country whole: the
 * Azores at 28.7° W are the westernmost thing in it, and nothing but Russia
 * reaches 60° E. Siberia is then in no continent a player can pick, and stays
 * reachable through the world or through Russia itself.
 */
export const EUROPE_LONGITUDES = { lonMin: -32, lonMax: 60 };

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
