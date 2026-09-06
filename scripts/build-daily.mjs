// Join the hand-authored daily boards with the gazetteer.
//
// `game/data/daily/` holds one file per day, and a board lists its cities by
// geonames id alone — the figures live in `public/cities5000.json` and nowhere
// else, so a corrected population or a newly translated name reaches every
// board the next time the site is built.
//
// The output is `game/data/dailyBoards.generated.json`: the same boards with
// each id expanded into the city the game plays with. `src/utils/daily.ts`
// imports that, so a day still costs no round trip at runtime — the join
// happens here rather than in the browser.
//
// Run by `next.config.js` on every `next dev` and `next build`, so there is no
// step to remember. Also available on its own:
//   npm run build:daily

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "game", "data", "daily");
const GAZETTEER = join(root, "public", "cities5000.json");
const OUTPUT = join(root, "game", "data", "dailyBoards.generated.json");

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A compact gazetteer row, in column order:
 * [geonameid, countryCode, latitude, longitude, population, elevation, name, nameDe]
 */
const toCity = (row) => ({
  id: row[0],
  ...(row[1] ? { country: row[1] } : {}),
  latitude: row[2],
  longitude: row[3],
  population: row[4],
  ...(row[5] !== null ? { elevation: row[5] } : {}),
  name: row[6],
  ...(row[7] ? { nameDe: row[7] } : {}),
});

export const buildDaily = async () => {
  const rows = JSON.parse(await readFile(GAZETTEER, "utf8"));
  const gazetteer = new Map(rows.map((row) => [row[0], row]));

  // The directory *is* the list: no index to keep in step with the files. A
  // missing directory means no authored days, which is a state the app already
  // handles — every day falls back to the drawn board.
  const entries = await readdir(SOURCE).catch(() => []);
  const files = entries.filter((name) => name.endsWith(".json")).sort();

  const boards = [];
  const seen = new Map();

  for (const file of files) {
    const board = JSON.parse(await readFile(join(SOURCE, file), "utf8"));
    const where = `game/data/daily/${file}`;

    if (!DAY.test(board.day ?? "") || Number.isNaN(Date.parse(`${board.day}T00:00:00Z`))) {
      throw new Error(`${where}: needs a "day" like 2026-09-19`);
    }
    if (seen.has(board.day)) {
      throw new Error(`${where}: ${board.day} is already claimed by ${seen.get(board.day)}`);
    }
    seen.set(board.day, where);
    if (!file.startsWith(`${board.day}-`)) {
      throw new Error(`${where}: the filename should start with ${board.day}-`);
    }
    if (!Array.isArray(board.cities)) throw new Error(`${where}: "cities" must be a list of ids`);

    const cities = board.cities.map((id) => {
      const row = gazetteer.get(id);
      if (!row) throw new Error(`${where}: no city ${id} in public/cities5000.json`);
      return toCity(row);
    });

    boards.push({
      day: board.day,
      ...(board.theme ? { theme: board.theme } : {}),
      cities,
    });
  }

  boards.sort((a, b) => a.day.localeCompare(b.day));
  const contents = `${JSON.stringify(boards, null, 2)}\n`;

  // Only write when something changed: this runs on every dev-server config
  // load, and rewriting a watched file each time would loop the watcher.
  const existing = await readFile(OUTPUT, "utf8").catch(() => null);
  if (existing === contents) return { boards: boards.length, written: false };

  await writeFile(OUTPUT, contents);
  return { boards: boards.length, written: true };
};

if ((process.argv[1] ?? "").endsWith("build-daily.mjs")) {
  buildDaily()
    .then(({ boards, written }) =>
      console.log(
        `${boards} daily boards joined with the gazetteer` +
          (written ? " → game/data/dailyBoards.generated.json" : " (already up to date)"),
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
