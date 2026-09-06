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
nothing. Sitting out is on the
same footing: it is only a real choice when a miss costs points, so it is
offered when **cost of a miss** is set and left out otherwise, rather than
sitting there as a strictly worse move. And in a default room, where none of
this is on, placing a card is the only thing a turn can be spent on — so there
is no box at all and the hand is live the moment your turn comes round.

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

A card in hand is drawn as a card: `CategoryCard` puts an index pip in two
opposing corners, the glyph on a ring in the middle, the criterion underneath
and, at the foot, the city it was played on. The board and the daily share the
component, so a card means the same thing in both — amber for the one in your
hand right now, teal for one already committed, and the daily's green/amber/grey
grading once the answers are out.

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

`useWakeLock` holds the screen awake while a turn is live — a phone dimming
mid-round costs more here than in most apps, because the turn clock keeps
running behind the lock screen. Browsers drop the lock whenever the tab is
hidden, so it is re-acquired on the way back. Where the API is missing or the
request is refused, the screen behaves as it normally would.

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

For implementation details — avatars and emoji rendering, audio synthesis,
deployment and CI, the daily authoring build pipeline, internationalisation, and
code architecture — see [DOCUMENTATION.md](DOCUMENTATION.md).

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
