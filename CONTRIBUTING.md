# Contributing to Urban Compass

Thanks for wanting to help. Here is what you can do and how to go about each one.

## Report a bug

Open a [GitHub issue](https://github.com/mikebarkmin/urban-compass/issues) and
describe what you did, what you expected, and what happened instead. A few
things that help:

- The room code (for multiplayer bugs) or the date (for daily puzzle bugs)
- The browser and operating system you were using
- A screenshot if something looks wrong on screen
- The JavaScript console output if the game threw an error

## Add a new locale

The app currently ships English and German. Adding a language means writing a
third dictionary and registering the locale.

1. **Create the dictionary.** `src/i18n/dictionaries.ts` holds every string in
   `en` and `de`, flat and namespaced (e.g. `"sets.title"`,
   `"daily.share"`). Copy the English block and translate the values. The keys
   must stay exactly as they are — the tests check that all dictionaries hold
   the same keys with the same placeholders (`{name}`, `{count}`, etc.).

2. **Register the locale.** In `src/i18n/index.tsx`, add the language code to the
   `Locale` type, the `LOCALES` array, the `LOCALE_LABELS` map (the language
   named in itself), and the `DICTIONARIES` record. The first render is always
   English so the server and client markup agree during hydration; the
   browser language is detected after mount.

3. **City names.** Cities carry an optional `nameDe` field for the German
   exonym. If your locale uses different names, add a `name<XX>` field to the
   `City` interface in `game/cities.ts` and a branch in `cityName` so the board
   reads naturally in your language. If you skip this, the English name is
   used, which is a fine starting point.

4. **Run the tests.** `npm test` enforces that the dictionaries hold the same
   keys and placeholders and that nothing the UI asks for is missing.

## Suggest a daily quiz

Daily puzzles can be hand-authored — a themed board for a specific date, made
instead of drawn. You can suggest one without touching the repository.

1. **Use the suggestion tool.** Go to
   [the sets editor](https://www.barkmin.eu/urban-compass/sets/) and scroll to
   the **Suggest a daily** panel. Pick a date, draw a board from a city set or
   search for cities by hand, add a theme, and save the draft.

2. **Download the file.** Each draft is one JSON file. Download it and send it
   in — attach it to a [GitHub issue](https://github.com/mikebarkmin/urban-compass/issues)
   describing what the board is about and which day it should run on.

3. **What makes a good board.** The six cards should be answered by six
   *different* cities — otherwise the puzzle collapses. No two cities on the
   board should share a name. The panel warns you when a card has no answer or
   one city takes several. If you want to see what committed boards look like,
   browse the [archive](https://www.barkmin.eu/urban-compass/archive/).

## Suggest a new city set

A city set is a named pool of cities the host can choose from. You can suggest
one by opening a [GitHub issue](https://github.com/mikebarkmin/urban-compass/issues)
with the following:

1. **Name and difficulty.** Give the set a name and a difficulty: `easy`
   (capitals and household names), `standard`, or `hard` (places most players
   cannot pin down). Include an emoji icon.

2. **The cities.** A list of cities with their names, country codes, coordinates
   (latitude, longitude), population, and optionally elevation (metres above
   sea level) and area (km²). At least 4 cities are needed. If the set includes
   elevation or area for *every* city, those cards become available; if any
   city is missing them, the cards are not offered.

   The easiest way to produce a set is to build it in
   [the sets editor](https://www.barkmin.eu/urban-compass/sets/), save it, and
   export it as a KMZ — the issue can attach that file.

3. **German names (optional).** If you know German exonyms (Rome → Rom), include
   them; otherwise the English name is used in both languages.
