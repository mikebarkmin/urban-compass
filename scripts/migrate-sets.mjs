// One-time migration: reads the hand-curated game/data/*.ts files and
// public/cities5000.json, matches each city to its geonameid by name +
// coordinates, and writes game/setDefs.json — the new source of truth for
// built-in sets. Cities not found in cities5000.json become overrides.
//
// Run once: node scripts/migrate-sets.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Load cities5000.json and build an index by name ────────────────────

const cities5000 = JSON.parse(
  await readFile(join(root, "public", "cities5000.json"), "utf8"),
);

/** name(lowercase) → array of [id, cc, lat, lon, pop, elev, name, nameDe] */
const byName = new Map();
for (const row of cities5000) {
  const name = row[6].toLowerCase();
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(row);
}

/** Also try the German name column for matching. */
const byNameDe = new Map();
for (const row of cities5000) {
  if (row[7]) {
    const name = row[7].toLowerCase();
    if (!byNameDe.has(name)) byNameDe.set(name, []);
    byNameDe.get(name).push(row);
  }
}

/**
 * Find the geonameid whose coordinates are closest to the target, among
 * candidates sharing the same (case-insensitive) name. Returns the row or
 * null when no candidate is within the coordinate tolerance.
 */
const COORD_TOLERANCE = 0.5; // degrees, ~55 km

const findByName = (name, lat, lon) => {
  const candidates = byName.get(name.toLowerCase()) ?? byNameDe.get(name.toLowerCase());
  if (!candidates) return null;

  let best = null;
  let bestDist = Infinity;
  for (const row of candidates) {
    const [, , rLat, rLon] = row;
    const dist = Math.abs(rLat - lat) + Math.abs(rLon - lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = row;
    }
  }
  if (bestDist > COORD_TOLERANCE) return null;
  return best;
};

/**
 * Fallback: find the closest city in the entire dataset by coordinates only.
 * Used when the name doesn't match (e.g. German exonym in the source data).
 */
const findByCoords = (lat, lon, tolerance = 0.1) => {
  let best = null;
  let bestDist = Infinity;
  for (const row of cities5000) {
    const [, , rLat, rLon] = row;
    const dist = Math.abs(rLat - lat) + Math.abs(rLon - lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = row;
    }
  }
  if (bestDist > tolerance) return null;
  return best;
};

/** Strip parenthetical suffixes like "Munich (München)" → "Munich". */
const stripParens = (name) => name.replace(/\s*\(.+\)\s*/, "").trim();

const findGeonameId = (name, lat, lon) => {
  // 1. Exact name (or German name) + coordinate proximity.
  let match = findByName(name, lat, lon);
  if (match) return match;

  // 2. Try without parenthetical: "Munich (München)" → "Munich".
  const stripped = stripParens(name);
  if (stripped !== name) {
    match = findByName(stripped, lat, lon);
    if (match) return match;
  }

  // 3. Coordinate-only fallback: the name may be a German exonym (Moskau,
  //    Wien) that doesn't appear in either the English or German column.
  return findByCoords(lat, lon);
};

// ── Parse the existing .ts data files ──────────────────────────────────

/**
 * Extract the City[] array from a .ts data file. The files all follow the
 * pattern: `export const xxxCities: City[] = [ ... ];`. The array literal
 * contains plain JS objects, so eval is safe here.
 */
const parseDataFile = (content) => {
  const match = content.match(/=\s*\[([\s\S]*)\];?\s*$/);
  if (!match) throw new Error("Could not find array in data file");
  // Re-wrap the array contents and eval — the objects are plain JS literals.
  // eslint-disable-next-line no-eval
  return eval("[" + match[1].trim().replace(/,\s*$/, "") + "]");
};

// Map of set id → { file, exportName, name, difficulty, icon }
const setSources = [
  { id: "europe-easy", file: "europeEasy", name: "Europe · the big names", difficulty: "easy", icon: "🇪🇺" },
  { id: "world-easy", file: "worldEasy", name: "World · the big names", difficulty: "easy", icon: "🌍" },
  { id: "nordics", file: "nordics", name: "Nordics", difficulty: "easy", icon: "❄️" },
  { id: "germany", file: "germany", name: "Germany", difficulty: "standard", icon: "🇩🇪" },
  { id: "usa", file: "usa", name: "USA", difficulty: "standard", icon: "🇺🇸" },
  { id: "asia", file: "asia", name: "Asia", difficulty: "standard", icon: "🌏" },
  { id: "north-america", file: "northAmerica", name: "North America", difficulty: "standard", icon: "🗽" },
  { id: "africa", file: "africa", name: "Africa", difficulty: "standard", icon: "🦁" },
  { id: "europe", file: "europe", name: "Europe", difficulty: "standard", icon: "🗺️" },
  { id: "world", file: "world", name: "World", difficulty: "standard", icon: "🌐" },
  { id: "europe-hard", file: "europeHard", name: "Europe · the far corners", difficulty: "hard", icon: "🧭" },
  { id: "world-hard", file: "worldHard", name: "World · the ends of the earth", difficulty: "hard", icon: "🏔️" },
  { id: "capitals", file: "capitals", name: "Capitals of the world", difficulty: "hard", icon: "🏛️" },
];

const setDefs = [];
const stats = { total: 0, matched: 0, overridden: 0 };

for (const src of setSources) {
  const path = join(root, "game", "data", `${src.file}.ts`);
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    console.warn(`Skipping ${src.id}: file not found at ${path}`);
    continue;
  }

  const cities = parseDataFile(content);
  const cityIds = [];
  const overrides = {};
  const unmatched = [];

  for (const city of cities) {
    stats.total++;
    const row = findGeonameId(city.name, city.latitude, city.longitude);
    if (row) {
      stats.matched++;
      cityIds.push(row[0]); // geonameid as string
    } else {
      stats.overridden++;
      unmatched.push(city.name);
      // Store as override — strip area since we're dropping it
      const { area, ...override } = city;
      overrides[city.id] = override;
    }
  }

  if (unmatched.length > 0) {
    console.warn(`${src.id}: ${unmatched.length} overrides: ${unmatched.join(", ")}`);
  }

  setDefs.push({
    id: src.id,
    name: src.name,
    difficulty: src.difficulty,
    icon: src.icon,
    cityIds,
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  });
}

// ── Write setDefs.json ─────────────────────────────────────────────────

const out = JSON.stringify(setDefs, null, 2);
await writeFile(join(root, "game", "setDefs.json"), out + "\n");

console.log(
  `\nWrote ${setDefs.length} set definitions to game/setDefs.json ` +
    `(${stats.matched}/${stats.total} matched in cities5000.json, ` +
    `${stats.overridden} overrides).`,
);
