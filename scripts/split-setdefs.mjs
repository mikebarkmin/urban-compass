// One-time split: reads game/setDefs.json and writes one JSON file per set
// into game/data/sets/. Each file is named after the set id (e.g.
// "europe-easy.json") and contains the set's definition without the id field
// (the id is the filename). Run once: node scripts/split-setdefs.mjs

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const setDefs = JSON.parse(
  await readFile(join(root, "game", "setDefs.json"), "utf8"),
);

await mkdir(join(root, "game", "data", "sets"), { recursive: true });

for (const def of setDefs) {
  const { id, ...rest } = def;
  const path = join(root, "game", "data", "sets", `${id}.json`);
  await writeFile(path, JSON.stringify(rest, null, 2) + "\n");
  console.log(`  ${id}.json`);
}

console.log(`\nWrote ${setDefs.length} set files to game/data/sets/`);
