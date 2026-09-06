# Urban Compass

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

For implementation details, see [DOCUMENTATION.md](DOCUMENTATION.md).
To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Running it

```bash
npm run dev         # the Next.js client on :3000
npm run dev:server  # the PartyKit server on :1999
```

Then open [http://localhost:3000](http://localhost:3000). Pick a name and a room
code; the first player into a room is the host. Share the room code (or the
"Copy link" button in the lobby) to bring others in.

Point the client at a different server with `NEXT_PUBLIC_SERVER_URL`.

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

Seven more switches, **all off by default**. The base game never depends on any
of them; turn one on when the table wants more to argue about.

| Mechanic | What it does |
| --- | --- |
| **Cancel matching bets** | Two players putting the same card on the same city pay neither of them. |
| **Cost of a miss** | −1, −2 or −3 for every card that lands on the wrong city. |
| **2× card** | One per player, per game or per round. Doubles what a bet pays — and what it costs. |
| **Steals** | Spend a turn naming what an opponent bet. |
| **Doubts** | Spend a turn doubting an opponent's bet on a city — no card named. |
| **Power-ups** | Once a round, spend a turn moving one of your placed chips to another city. |
| **Runner-up consolation** | The first player to bet a category's runner-up city banks 1 point. |

The action box only shows mechanics the room actually plays with, each carrying
its stake upfront. In a default room, placing a card is the only thing a turn can
be spent on.

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

The gating is all-or-nothing per set: a pool where half the cities have an
elevation would quietly hand "lowest" to whichever city was missing one.

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

The turn clock runs on the server, so a backgrounded tab or a closed laptop
cannot stall the table. One expired turn is skipped; a second takes that player
out of the round.

### The board draw

A uniform random draw lets one outlier city routinely take three of the six
categories, which collapses the game. The **balanced** draw rejection-samples
for a board whose six answers are six *different* cities. `random` keeps the
old behaviour if you want it.

## The daily puzzle

`/daily` is a solo board, the same for everybody, drawn from the date alone —
`buildPuzzle` seeds a small PRNG with the day key, so no server has to remember
anything. You place all six cards at once, reveal, and get a shareable grid:

```
Urban Compass Daily #248 — 4/6
🟨🟩🟩🟩⬛🟩
```

🟩 is right, 🟨 the runner-up city, ⬛ not close. Streaks and averages live in
`localStorage`; today's attempt is one-shot and comes back on reload.

The emoji squares are for the copied text, where they render in any chat app. The
grid on the page itself is drawn in CSS — those glyphs are missing from a fair
number of emoji fonts and fall back to empty boxes.

The **archive** at `/archive` lists every puzzle since the first one, newest
first, grouped by month. A day you have finished shows its mark pattern and
score; anything else is a link to go and play it. Authored days carry their
theme as a badge, and today's entry is highlighted.

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

The host can also upload a **KMZ or KML** file — a Google My Maps export works
as-is. Cities without a name, coordinates or a population are skipped and listed
in the upload preview. `public/europa.kmz` is included as a sample.

A set can also be exported back out as a KMZ for Google Earth and Maps.

---

## Credits

Emoji assets in `public/emoji/` are from [Twemoji](https://github.com/jdecked/twemoji)
(continuation of Twitter's original set), licensed under
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

City data in `public/cities5000.json` is derived from
[GeoNames](https://www.geonames.org/) (`cities5000` and the alternate-names
dump), preprocessed by `scripts/build-cities.mjs`. GeoNames is licensed under
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Inspiration

Urban Compass was inspired by the geography game **Spot On** by KOSMOS.

If you enjoy this kind of game and would like to play a similar game offline with physical cards, consider buying the original **Spot On** from KOSMOS or looking for a second-hand copy.

Urban Compass is an independent open-source project and is not affiliated with or endorsed by KOSMOS or the creators of Spot On.
