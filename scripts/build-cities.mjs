// Preprocess the geonames dumps into a compact dataset the city-set builder
// filters in the browser.
//
// Sources (committed under data/):
//   - data/cities5000.txt        all populated places (feature class P) with a
//                               population >= 5000, 19 tab-separated geonames
//                               columns.
//   - data/alternateNamesV2.txt the full geonames alternate-names dump
//                               (~747 MB, ~19M rows). Columns: alternateNameId,
//                               geonameId, isolanguage, name, isPreferred,
//                               isShort, isColloquial, isHistoric, ...
//                               Only the `de`-language rows are kept, and only
//                               for geonameids that appear in cities5000.txt, so
//                               the file is streamed line by line rather than
//                               read into memory.
//
// Output: public/cities5000.json — an array of arrays, one row per city, in
// this column order:
//   [geonameid, countryCode, latitude, longitude, population, elevation, name, nameDe]
// `elevation` is `null` when neither the elevation nor the dem column is
// usable. `nameDe` is omitted (set to `null`) when there is no distinct German
// exonym, so `cityName()` falls back to the English `name`.
//
// Run manually when the source datasets change:
//   npm run build:cities

import { readFile, writeFile, open } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Parse a geonames row into the fields the game needs. */
const parseCity = (line) => {
  const c = line.split("\t");
  if (c.length < 18) return null;

  const population = Number(c[14]); // column 15 (0-indexed 14)
  if (!Number.isFinite(population) || population <= 0) return null;

  const latitude = Number(c[4]); // column 5
  const longitude = Number(c[5]); // column 6
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const name = c[1]; // column 2
  if (!name) return null;

  const countryCode = c[8] || null; // column 9

  // Elevation (column 16) is often empty; fall back to dem (column 17), which
  // is the average elevation of the 90m SRTM tile around the point.
  const elevRaw = c[15];
  const demRaw = c[16];
  let elevation = null;
  const elev = Number(elevRaw);
  const dem = Number(demRaw);
  if (Number.isFinite(elev) && elev !== 0) elevation = Math.round(elev);
  else if (Number.isFinite(dem) && dem !== 0) elevation = Math.round(dem);

  return [
    c[0], // geonameid (kept as a string)
    countryCode,
    latitude,
    longitude,
    Math.round(population),
    elevation,
    name,
    null, // nameDe, filled in from alternateNamesV2.txt
  ];
};

/**
 * Stream alternateNamesV2.txt and build a map of geonameid -> German name,
 * keeping only rows whose geonameId is in `cityIds`. A row with isPreferred
 * === "1" wins; otherwise the first non-empty `de` name is used. The file is
 * streamed line by line so the 747 MB source is never held in memory.
 */
const buildGermanNames = async (cityIds) => {
  const preferred = new Map();
  const fallback = new Map();

  const handle = await open(join(root, "data", "alternateNamesV2.txt"));
  try {
    const lines = createInterface({
      input: handle.createReadStream(),
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of lines) {
      // Fast reject: the overwhelming majority of rows are not German. A
      // single tab-delimited field check is cheaper than a full split.
      if (!line.includes("\tde\t")) continue;

      const c = line.split("\t");
      if (c.length < 5 || c[2] !== "de") continue; // isolanguage
      const geonameId = c[1];
      if (!cityIds.has(geonameId)) continue;
      const name = c[3];
      if (!name) continue;
      if (c[4] === "1") preferred.set(geonameId, name);
      else if (!fallback.has(geonameId)) fallback.set(geonameId, name);
    }
  } finally {
    await handle.close();
  }

  const names = new Map();
  for (const [id, name] of fallback) names.set(id, name);
  for (const [id, name] of preferred) names.set(id, name);
  return names;
};

const main = async () => {
  const raw = await readFile(join(root, "data", "cities5000.txt"), "utf8");
  const rows = [];
  const cityIds = new Set();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const city = parseCity(line);
    if (!city) continue;
    cityIds.add(city[0]);
    rows.push(city);
  }

  const germanNames = await buildGermanNames(cityIds);

  for (const city of rows) {
    const nameDe = germanNames.get(city[0]);
    // Skip storing a German name that is identical to the English one — there
    // is no distinct exonym, and cityName() already falls back to `name`.
    city[7] = nameDe && nameDe !== city[6] ? nameDe : null;
  }

  const out = JSON.stringify(rows);
  await writeFile(join(root, "public", "cities5000.json"), out);

  const withDe = rows.filter((r) => r[7] !== null).length;
  console.log(
    `Wrote ${rows.length} cities to public/cities5000.json ` +
      `(${withDe} with a distinct German name, ` +
      `${(out.length / 1024 / 1024).toFixed(1)} MB raw).`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
