// Check the hand-authored daily boards after the build has joined them with
// the gazetteer.
//
// The boards themselves are only ids and a theme, so there is nothing left to
// drift — a corrected population or a new translation reaches them the next
// time the site is built. What a change like that *can* do is move an answer,
// which is why this prints the six answers for every board: a diff of that
// output is how you notice the gazetteer decided a board means something else.
//
//   npm run check:daily
//
// Anything that would make a board unplayable is an error and exits non-zero.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The six cards every daily board plays, and how each one is decided. */
const CARDS = [
  ["N", (c) => c.latitude, 1],
  ["S", (c) => c.latitude, -1],
  ["E", (c) => c.longitude, 1],
  ["W", (c) => c.longitude, -1],
  ["most", (c) => c.population, 1],
  ["fewest", (c) => c.population, -1],
];

const main = async () => {
  const boards = JSON.parse(
    await readFile(join(root, "game", "data", "dailyBoards.generated.json"), "utf8"),
  );

  const problems = [];

  for (const board of boards) {
    const fail = (message) => problems.push(`${board.day}: ${message}`);
    const cities = board.cities ?? [];

    if (cities.length < 4 || cities.length > 16) fail(`${cities.length} cities, outside 4–16`);
    if (new Set(cities.map((c) => c.id)).size !== cities.length) fail("the same city twice");
    // A board shows a name and nothing else, so two of the same is unplayable.
    if (new Set(cities.map((c) => c.name)).size !== cities.length) fail("two cities of one name");
    if (typeof board.theme?.en !== "string" || !board.theme.en.trim()) {
      fail("theme.en is what every reader falls back to, and it is missing");
    }

    const answers = CARDS.map(([card, of, direction]) => {
      const ranked = [...cities].sort((a, b) => (of(b) - of(a)) * direction);
      if (ranked.length > 1 && of(ranked[0]) === of(ranked[1])) {
        fail(`${card}: ${ranked[0].name} and ${ranked[1].name} tie, so the answer is arbitrary`);
      }
      return ranked[0];
    });
    if (new Set(answers.map((c) => c?.id)).size !== CARDS.length) {
      fail(`${new Set(answers.map((c) => c?.id)).size} cities answer the six cards; a good board wants six`);
    }

    console.log(
      `${board.day}  ${(board.theme?.en ?? "—").padEnd(38)}` +
        CARDS.map(([card], i) => `${card}=${answers[i]?.name}`).join("  "),
    );
  }

  console.log("");
  for (const problem of problems) console.log(`  ${problem}`);
  if (problems.length) {
    console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"} in ${boards.length} boards.`);
    process.exit(1);
  }
  console.log(`${boards.length} boards, every one answering its six cards with six different cities.`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
