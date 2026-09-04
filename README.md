# 🎯 Urban Guessr

A turn-based multiplayer geography game. Everyone holds the same six cards —
_northernmost_, _southernmost_, _easternmost_, _westernmost_, _most inhabitants_,
_fewest inhabitants_ — and places some of them, one per turn, face down on the
cities they think those cards belong to.

The twist: other players see **that** you bet on a city, never **which** card it
was. Coordinates and populations are withheld by the server until the round ends,
so the board gives nothing away. When everyone is out of cards the answers are
revealed, and the first three players to get a category right score **3 · 2 · 1**
points.

The interface is available in **English and German**, switchable in the header;
city names carry a German exonym where one exists, so the board reads *Athen*
and *Zürich* rather than *Athens* and *Zurich*.

There is also a [solo daily puzzle](#the-daily-puzzle) for when nobody else is
around.

## Running it

```bash
npm run dev         # the Next.js client on :3000
npm run dev:server  # the PartyKit server on :1999
```

Then open [http://localhost:3000](http://localhost:3000). Pick a name and a room
code; the first player into a room is the host. Share the room code (or the
"Copy link" button in the lobby) to bring others in.

Point the client at a different server with `NEXT_PUBLIC_SERVER_URL`.

## Deploying

The two halves deploy to two places: the client is a static export on **GitHub
Pages**, the room server goes to **PartyKit**. `.github/workflows/deploy.yml`
does both on every push to `main` — PartyKit first, so the client can be built
against the URL the server ended up on.

Two repository secrets are needed:

| Secret            | Where it comes from                     |
| ----------------- | --------------------------------------- |
| `PARTYKIT_TOKEN`  | `npx partykit token generate`           |
| `PARTYKIT_LOGIN`  | your PartyKit (GitHub) username         |

Then set **Settings → Pages → Source** to *GitHub Actions*.

The build is driven by two variables the workflow fills in:

- `NEXT_PUBLIC_BASE_PATH` — `/urban-compass` on a project page, empty on a
  custom domain. Taken from `actions/configure-pages`, so a custom domain needs
  no change here.
- `NEXT_PUBLIC_SERVER_URL` — defaults to
  `<partykit.json name>.<PARTYKIT_LOGIN>.partykit.dev`. Set a repository
  variable of the same name to point at a custom server domain instead.

Deploying either half by hand:

```bash
npm run deploy:server                                   # PartyKit
NEXT_PUBLIC_BASE_PATH=/urban-compass npm run build      # writes ./out
```

Because the client is fully static there is no Next.js server in production —
`npm start` serves the exported `out/` directory rather than running one.

## Table rules

Everything about the shape of a game is the host's to set from the lobby, and
every player sees the changes live. The server clamps each value in
`applySettings`, so a doctored client cannot widen the game.

| Setting              | Range              | What it does                                                    |
| -------------------- | ------------------ | --------------------------------------------------------------- |
| **Rounds per player**| 1–5                | How many rounds each player opens. The game length follows from it |
| **Cities per round** | 6–12               | The size of the board                                             |
| **Cards per player** | 1–6                | How many of the six cards each player gets to place               |
| **Turn clock**       | off, or 20–90s     | Time to place a card before the turn passes on                    |
| **Cards in play**    | any 3+ of 10       | Which criteria the room plays with (see below)                    |
| **Board draw**       | balanced / random  | Whether round boards are rejection-sampled (see below)            |

Settings are locked while a round is being played.

### Optional mechanics

Four more switches, **all off by default**. The base game never depends on any
of them; turn one on when the table wants more to argue about.

| Mechanic | What it does |
| --- | --- |
| **Cancel matching bets** | Two players putting the same card on the same city pay neither of them. |
| **Cost of a miss** | −1, −2 or −3 for every card that lands on the wrong city. |
| **2× card** | One per player, per game or per round. Doubles what a bet pays — and what it costs. |
| **Steals** | Spend a turn naming what an opponent bet. |

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

Cards lost this way still count against your hand, so a round always ends: the
reducer's fuzz tests play 300 games with every mechanic on and none of them
runs long.

### The cards

Six cards work on any set, because every city carries coordinates and a
population:

| | | | |
| --- | --- | --- | --- |
| ↑ Northernmost | ↓ Southernmost | → Easternmost | ← Westernmost |
| ▲ Most inhabitants | ▼ Fewest inhabitants | | |

Four more need figures a set may not carry, and are only offered when **every**
city in the pool has them:

| | |
| --- | --- |
| ⇧ Highest above sea level | ⇩ Lowest above sea level |
| ■ Largest area | □ Smallest area |

Altitude is the one that changes a set most: on *World · the big names* it puts
La Paz at 3,640 m against Rio at 2 m, and on *World · the ends of the earth*
Jericho sits at −258 m. Area is the specialist — it needs an administrative
figure that only makes sense for a real city, which is why the two "far corners"
sets carry altitude but not area.

The gating is all-or-nothing per set on purpose. A pool where half the cities
have an elevation would quietly hand "lowest" to whichever city was missing one,
so `categorySupported` requires the whole pool, and a set switch re-filters the
room's selection back to what the new pool can answer.

### How long a game lasts

A game runs until **every player has opened a round**, so with four players at
two rounds each it is eight rounds long. The opening seat is picked at random
from whoever has opened fewest rounds so far, and the turn order for the round is
rotated to start with them.

That matters because points are paid out in placement order: the first player to
get a category right takes 3, the second 2, the third 1. Whoever opens the round
has first claim on every answer, so the seat has to move — before this, the
player who happened to join the room first opened every round and won every tie
for the rest of the game.

Someone joining mid-game has opened nothing yet, so the game stretches by a round
to give them their turn at the front.

### The turn clock

Clocks live on the server, in `party/index.ts`. A backgrounded tab or a closed
laptop cannot stall the table, and a client cannot fake the expiry to skip past
somebody — `turn_timeout` is deliberately missing from `CLIENT_ACTION_TYPES`.
Broadcasts carry a `serverNow` stamp that clients offset against, so the
countdown agrees with the room even when a player's own clock is minutes out.

One expired turn is skipped; a second takes that player out of the round, which
also stops a table of idle players looping forever.

### The board draw

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

## The daily puzzle

`/daily` is a solo board, the same for everybody, drawn from the date alone —
`buildPuzzle` seeds a small PRNG with the day key, so no server has to remember
anything. You place all six cards at once, reveal, and get a shareable grid:

```
Urban Guessr Daily #248 — 4/6
🟨🟩🟩🟩⬛🟩
```

🟩 is right, 🟨 the runner-up city, ⬛ not close. Streaks and averages live in
`localStorage`; today's attempt is one-shot and comes back on reload.

The emoji squares are for the copied text, where they render in any chat app. The
grid on the page itself is drawn in CSS — those glyphs are missing from a fair
number of emoji fonts and fall back to empty boxes.

## City sets

The host chooses what everyone guesses from. Sets are grouped by how much
geography they ask of you:

| Set | Difficulty | Cities | Cards | Source |
| --- | --- | --- | --- | --- |
| Europe · the big names | easy | 40 | all 10 | `game/data/europeEasy.ts` |
| World · the big names | easy | 36 | all 10 | `game/data/worldEasy.ts` |
| Germany | standard | 40 | core 6 | `game/data/germany.ts` |
| Europe | standard | 90 | core 6 | `game/data/europe.ts`, from the "Spot on Europa" map |
| World | standard | 70 | core 6 | `game/data/world.ts` |
| Europe · the far corners | hard | 40 | 8 (no area) | `game/data/europeHard.ts` |
| World · the ends of the earth | hard | 38 | 8 (no area) | `game/data/worldHard.ts` |

The easy sets are capitals and household names. The hard sets are deliberately
weighted towards the edges — Longyearbyen at 78°N, Alert at 82°N, McMurdo at
78°S, Astrakhan and Jericho below sea level — so a compass or altitude card is
genuinely contested rather than obvious.

> **On the figures.** Populations, elevations and areas throughout are
> approximate published values, the same standing this repo's original data has.
> Elevation is metres at the city centre and area is the administrative area of
> the city proper, which is the reading most people mean but not the only one
> available. Worth spot-checking the four newer sets before a competitive game.

City names are stored English-first with an optional `nameDe`; `cityName(city,
locale)` picks between them. An uploaded set carries one name and uses it in
both languages.

The host can also upload a **KMZ or KML** file — a Google My Maps export works
as-is. `src/utils/kmz.ts` unpacks the archive (a small ZIP reader over
`DecompressionStream`, no dependencies) and reads the placemarks. It handles both
proper `<Point>` geometry and spreadsheet-style exports where latitude, longitude
and population sit in unnamed `<ExtendedData>` columns — including files that
write coordinates as degrees.minutes rather than decimal degrees, which it
detects from the values themselves. The upload preview shows the parsed
coordinates, a scatter map, and escape hatches to re-read the file as the other
coordinate format or to swap latitude and longitude if the guess was wrong.

Cities without a name, coordinates or a population are skipped and listed in the
preview. `public/europa.kmz` is included as a sample.

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
| `party/index.ts`          | The PartyKit room: applies actions, runs the clock, broadcasts state |
| `src/components/`         | Lobby, Board, Results, GameOver, Daily and the shared UI primitives |
| `src/hooks/useGameRoom`   | The client's socket: `gameState` in, `dispatch` out         |
| `src/utils/daily.ts`      | The daily puzzle: seeding, marking, streaks, share text      |
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
