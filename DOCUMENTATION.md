# Urban Compass — Technical Documentation

Implementation details for contributors and maintainers. For game rules and
basic usage, see [README.md](README.md).

## Optional mechanics in depth

Seven switches, all off by default. The base game never depends on any of them.

**Cancel matching bets** is the one that makes the headline mechanic matter.
Without it the visible chips are atmosphere: seeing three players on Tromsø
changes nothing you would do. With it, a crowded city is a reason to look
elsewhere, and being right on your own is worth more than being right.

**The 2× card** is public — the chip on the board shows it — which is the point.
It says somebody is sure without saying what about, and with steals on it paints
a target: the confident bets are the ones worth calling.

**Steals** put the hidden information in play directly. On your turn, instead of
placing, you name a player, a city and a card. Get it right and you take the bet
*and its place in the queue*, so you inherit the payout it would have earned;
the victim's card is gone rather than returned. Get it wrong and your own card
burns, and the whole table now knows what that city is *not*. A 2× does not
travel with a stolen bet — that was the other player's gamble.

**Doubts** are the bluffer's read. A steal makes you name the card; a doubt does
not. You pick a player and a city and assert that their bet there is a mistake.
The server knows the answers (the clients do not), so it resolves the call
without leaking anything: if every card the target laid on that city is wrong,
you bank 2 points for the reveal; if any one of them is right, your own card
burns. It is the lighter, noisier cousin of a steal — you never have to commit
to a category, which makes it the move to make when three chips are piled on the
obvious outlier and you suspect the pile is wrong.

**Power-ups** give you a take-back. Once a round, instead of placing, you move
one of your already-placed chips to another city. The chip is still face-down,
so opponents see *that* you moved it, never *what* it was — a loud, public tell
that says you changed your mind without saying about what. A swap re-enters the
destination queue at the back, so moving late costs you placement priority: the
trade for getting to watch everyone else bet first.

**Runner-up consolation** pays 1 point to the earliest player who bet a
category's runner-up city, so a near miss is not worth nothing. It gives the
player who almost had it something to chase late in a round, and it makes the
second-best read matter on sets where the outlier is obvious.

Cards lost this way still count against your hand, so a round always ends: the
reducer's fuzz tests play 300 games with every mechanic on and none of them
runs long.

**What a turn offers** follows from these switches. The action box lists only
what the room actually plays with — steals, doubts and power-ups appear because
they were turned on, not greyed out because they were not. Each one carries its
stake: what it pays when it lands and what it costs when it does not, so the
choice between calling a bet and doubting one is a read on the table rather than
a guess about the rules. Placing shows the live miss penalty, so the same tile
says something different in a room that docks 2 points than in one that docks
nothing. Sitting out is on the same footing: it is only a real choice when a
miss costs points, so it is offered when **cost of a miss** is set and left out
otherwise, rather than sitting there as a strictly worse move. And in a default
room, where none of this is on, placing a card is the only thing a turn can be
spent on — so there is no box at all and the hand is live the moment your turn
comes round.

A card in hand is drawn as a card: `CategoryCard` puts an index pip in two
opposing corners, the glyph on a ring in the middle, the criterion underneath
and, at the foot, the city it was played on. The board and the daily share the
component, so a card means the same thing in both — amber for the one in your
hand right now, teal for one already committed, and the daily's green/amber/grey
grading once the answers are out.

### Turn clock

Clocks live on the server, in `party/index.ts`. A backgrounded tab or a closed
laptop cannot stall the table, and a client cannot fake the expiry to skip past
somebody — `turn_timeout` is deliberately missing from `CLIENT_ACTION_TYPES`.
Broadcasts carry a `serverNow` stamp that clients offset against, so the
countdown agrees with the room even when a player's own clock is minutes out.

One expired turn is skipped; a second takes that player out of the round, which
also stops a table of idle players looping forever.

`useWakeLock` holds the screen awake while a turn is live — a phone dimming
mid-round costs more here than in most apps, because the turn clock keeps
running behind the lock screen. Browsers drop the lock whenever the tab is
hidden, so it is re-acquired on the way back. Where the API is missing or the
request is refused, the screen behaves as it normally would.

### Board draw

A uniform random draw is a worse game than it looks. Sampling 20,000 boards of
eight cities:

| Set    | Distinct answer cities (of 6) | One city answers 2+ | One city answers 3+ |
| ------ | ----------------------------- | ------------------- | ------------------- |
| Europe | 4.44                          | 92%                 | 17%                 |
| World  | 4.17                          | 97%                 | 34%                 |

One outlier — Reykjavík, Papeete, Tromsø — routinely takes three of the six
categories, which collapses six decisions into four and makes "pile everything
onto the obvious city" the whole game.

The **balanced** draw in `drawBoard` rejection-samples for a board whose six
answers are six *different* cities, which it reaches in under a millisecond and
for effectively every board size. `random` keeps the old behaviour if you want it.

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
