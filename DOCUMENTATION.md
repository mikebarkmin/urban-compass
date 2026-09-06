# Urban Compass — Technical Documentation

Implementation details for contributors and maintainers. For game rules and
basic usage, see [README.md](README.md).

## Avatars

Every player gets a randomized avatar on join — a hue and an animal emoji —
shown on their puck in the lobby, on the board chips, the results screen and
the podium. The lobby has an editor below the player list: a colour swatch
row, a symbol grid, and a randomize button. Changes apply live, so everyone
in the room sees the new avatar the moment it is picked.

The emoji are rendered from self-hosted Twemoji SVGs (`public/emoji/`) rather
than the system emoji font, so a puck looks the same on Windows, macOS, Linux
and Android. The same applies to every other emoji in the app — city set icons,
the mute toggle, the host crown, and emoji embedded in translated strings.
`EmojiText` does the swap inside a translated string; `Emoji` takes a single
symbol.

Nothing else is left to the OS either. The typographic symbols — the card
faces, the inline arrows, the copied checkmark, the reveal drumroll and the
wordmark — are drawn as SVG paths by `src/components/Glyph.tsx`. They used to
be Unicode characters, but the double arrows and the geometric shapes are
missing from common fonts and fell back to an empty box, and a card that
renders as a box is unplayable. `CategoryIcon` draws a card's glyph; the
minimap inlines the same paths into its own `<svg>`.

The only symbols still typed as text are the daily-share squares, which go to
the clipboard for a chat app to render.

## Sound, haptics and feedback

The game has no audio assets. `src/hooks/useSound.tsx` synthesises every cue
from oscillators and noise buffers through the Web Audio API at the moment it
fires — a sine blip for a card landing, a two-tone chime for a correct call, a
low sawtooth buzz for a miss, a white-noise drumroll before the reveal, a
triangle-wave fanfare at game over, a tense two-note question for a doubt, and
an upward swoop for a power-up swap. On a phone the same cues also vibrate:
short `navigator.vibrate` patterns that land even when the device is on
silent. The mute toggle in the header covers both — it is the one "make the
game quiet" control — and the choice persists in `localStorage`. Flourishes
(drumroll, fanfare) are skipped when the user has requested reduced motion;
chimes still land.

Two overlays ride on top of the log. `ActionFlash` watches the shared
activity log and pops a verdict card over the board when a steal or a doubt
resolves — driven by the log rather than the acting player's dispatch, so
everyone at the table sees the same verdict at the same time, including the
player who was called. `Confetti` is a dependency-free particle burst on a
full-screen canvas, fired on a category win and bumped for the game-over
finale; it is skipped entirely under reduced motion.

## Deploying

The two halves deploy to two places: the client is a static export on **GitHub
Pages**, the room server goes to **PartyKit**. `.github/workflows/deploy.yml`
does both on every push to `main` — PartyKit first, so the client can be built
against the URL the server ended up on.

Three repository secrets are needed:

| Secret              | Where it comes from                     |
| ------------------- | --------------------------------------- |
| `PARTYKIT_TOKEN`    | `npx partykit token generate`           |
| `PARTYKIT_LOGIN`    | your PartyKit (GitHub) username         |
| `PARTYKIT_SERVER`   | the full URL the client connects to, e.g. `<partykit.json name>.<PARTYKIT_LOGIN>.partykit.dev` or a custom domain |

Then set **Settings → Pages → Source** to *GitHub Actions*.

The build is driven by two variables the workflow fills in:

- `NEXT_PUBLIC_BASE_PATH` — `/urban-compass` on a project page, empty on a
  custom domain. Taken from `actions/configure-pages`, so a custom domain needs
  no change here.
- `NEXT_PUBLIC_SERVER_URL` — set in CI from the `PARTYKIT_SERVER` secret. The
  workflow's "Resolve server URL" step falls back to
  `<partykit.json name>.<PARTYKIT_LOGIN>.partykit.dev` when the secret is
  empty, but the build itself always reads the secret.

Deploying either half by hand:

```bash
npm run deploy:server                                   # PartyKit
NEXT_PUBLIC_BASE_PATH=/urban-compass npm run build      # writes ./out
```

Because the client is fully static there is no Next.js server in production —
`npm start` serves the exported `out/` directory rather than running one.

## Hand-authored daily puzzles

A day can be written rather than drawn. `game/data/daily/` holds **one file per
day**, named for the date and what the board is about, and anything in there
wins over the draw:

```
game/data/daily/
  2026-09-19-oktoberfest-bavaria.json
  2026-09-23-equinox-around-the-equator.json
```

```json
{
  "day": "2026-09-19",
  "theme": { "en": "Oktoberfest — Bavaria", "de": "Oktoberfest — Bayern" },
  "cities": ["2867714", "2855328", "2849483", "2861650"]
}
```

A board names its cities by **geonames id alone**. The figures live in
`public/cities5000.json` and nowhere else, so a corrected population or a newly
translated name reaches every board that uses that city without anyone editing
a puzzle. The day is inside the file as well as in its name, so the file is
self-describing and the name is free to say what the board is about.

`scripts/build-daily.mjs` joins the two: it reads every file in the directory —
the directory *is* the list, there is no index to keep in step — expands each id
against the gazetteer, and writes `game/data/dailyBoards.generated.json`, which
`src/utils/daily.ts` imports. `next.config.js` runs it, so every `next dev` and
`next build` does the join and there is no step to remember; an id that is not
in the gazetteer throws and fails the build rather than shipping a broken day.
The generated file is not committed. Adding a day means dropping a file in.

Because the join happens at build time rather than in the browser, an authored
day still costs no round trip: `/daily` never fetches the 1.45 MB gazetteer,
which only the authoring tools on `/sets` pull. The trade is that a gazetteer
refresh can move an answer on a board somebody has already played, so
`npm run check:daily` prints the six answers for every board — a diff of that
output is how you notice — and fails on anything that would make a board
unplayable: fewer than four cities, the same city or the same *name* twice
(the board shows a name and nothing else), a tie for a card, or six cards
answered by fewer than six cities. CI runs it before the build, so a board that
has stopped working stops the deploy rather than shipping.

The **theme** is the puzzle's title, in place of "Daily #262", with the number
moving down to the line beneath it. English is required, because it is what
every other reader falls back to; German is optional and falls back to the
English. A bare string is still read as English-only, which is what drafts
written before the field could be translated look like.

Each entry is validated once at load and a bad one is *dropped* rather than
thrown: a day that is malformed, too small, or unable to answer all six cards
falls back to the drawn board rather than taking the app down. Build one in
`/sets` → **Suggest a daily**, which writes the file for you to download — a
day at a time, or all of them at once.

Thirty-three days are committed, every Wednesday and Saturday from 9 September
to the end of 2026 — rivers (the Danube, the Rhine, the Nile, the
Trans-Siberian line beside them), waters (Hanseatic and Mediterranean ports, the
Great Lakes, the mouths of the great rivers), latitudes (the equator at the
equinox, the far north, the far south, Christmas in the southern summer) and
dates that carry their own theme (Mexican Independence Day, Oktoberfest, German
Unity Day, UN Day, Halloween, the Iron Curtain around 9 November, Thanksgiving,
the Advent markets, and where the new year begins).

Each was picked so that the six cards are answered by six *different* cities —
the bar `drawBoard`'s balanced draw sets for itself — and so that no two cities
on a board share a name. Where a theme could not meet that bar it was re-cut
rather than shipped: New England alone puts both the northern and the eastern
answer in Maine, so Thanksgiving became the Pilgrims' crossing instead.

## KMZ import and export

`src/utils/kmz.ts` unpacks the uploaded archive (a small ZIP reader over
`DecompressionStream`, no dependencies) and reads the placemarks. It handles both
proper `<Point>` geometry and spreadsheet-style exports where latitude, longitude
and population sit in unnamed `<ExtendedData>` columns — including files that
write coordinates as degrees.minutes rather than decimal degrees, which it
detects from the values themselves. The upload preview shows the parsed
coordinates, a scatter map, and escape hatches to re-read the file as the other
coordinate format or to swap latitude and longitude if the guess was wrong.

City names are stored English-first with an optional `nameDe`; `cityName(city,
locale)` picks between them. An uploaded set carries one name and uses it in
both languages.

`src/utils/kmzExport.ts` is the inverse of the reader — it builds a KMZ from a
`City[]` in the browser, with no dependency: KML with `<Point>` geometry for
Google Earth and Maps, plus `<ExtendedData>` columns so the file round-trips
through the app's own reader. The output is a single-entry ZIP produced with
`CompressionStream`, matching what the reader's `DecompressionStream` expects.

## Languages

`src/i18n/dictionaries.ts` holds every string in English and German, flat and
namespaced. `LocaleProvider` picks the browser's language on first load and
remembers a manual choice in `localStorage`; the first render is always English
so the server and client markup agree during hydration.

Server-side log lines are the interesting case. The room broadcasts one state to
everybody, so a finished English sentence would be wrong for half the table —
log entries are stored as `{ key, params }` and the sentence is built on each
client. `ActivityLog` resolves the parts that are themselves translatable (a set
id, a card name) before handing the rest to `t`.

Tests enforce that the two dictionaries hold the same keys with the same
placeholders, that every `log.*` key the reducer emits exists, that every
`t("…")` the UI asks for resolves, and that nothing is left untranslated.

## Layout

The project is a monorepo holding both the client (Next.js) and the server
(PartyKit), sharing types and game logic.

| Path                      | What lives there                                            |
| ------------------------- | ----------------------------------------------------------- |
| `game/logic.ts`           | `GameState`, `GameSettings`, the `GameAction`s, `scoreRound` and the `gameUpdater` reducer |
| `game/cities.ts`          | The city and card model, the board draw, answer resolution, formatting |
| `game/citySets.ts`        | Built-in pools and validation for uploaded ones             |
| `game/avatar.ts`          | The avatar model: hues, symbols, randomization             |
| `party/index.ts`          | The PartyKit room: applies actions, runs the clock, broadcasts state |
| `src/components/`         | Lobby, Board, Results, GameOver, Daily, Archive, ActionFlash, Confetti and the shared UI primitives |
| `src/hooks/useGameRoom`   | The client's socket: `gameState` in, `dispatch` out         |
| `src/hooks/useSound`      | Synthesised audio cues and haptics, the mute toggle         |
| `src/hooks/useWakeLock`   | Holds the screen awake while a turn is live                 |
| `src/utils/daily.ts`      | The daily puzzle: seeding, marking, streaks, share text      |
| `src/utils/kmz.ts`        | KMZ/KML import: archive unpack, placemark parsing, coordinate detection |
| `src/utils/kmzExport.ts`  | KMZ export: builds a KMZ from a city set in the browser     |
| `src/i18n/`               | The English and German dictionaries and the locale provider |

### The reducer pattern

Clients never mutate anything directly. They `dispatch` a `GameAction` over the
websocket; the server tags it with the sending user, runs it through
`gameUpdater(action, state)`, and broadcasts the resulting state to everyone.

### Scoring

`scoreRound` is the single source of truth for what a round paid out. It returns
a `RoundOutcome` — per category who was in contention and what each bet was
worth, plus per player the earned/docked split — and both the server (to move
the scoreboard) and the results screen (to explain it) run the same function
over the same data, so the board and the scoreboard cannot tell different
stories.

### What the server withholds

`party/index.ts` projects `GameState` into a `ClientGameState` before every
broadcast. While a round is in progress the in-play cities are stripped of their
coordinates and populations, and the full city pool is replaced by its size — the
answers only exist on the server until the reveal. Incoming messages are filtered
against `CLIENT_ACTION_TYPES`, uploaded city pools are validated by
`sanitizeCityPool` before they can touch the game state, and every host-only
action re-checks `hostId` server-side.
