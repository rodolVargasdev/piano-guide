# PR 10a2: Router, player label and header language selector

Branch: `feat/learn-mode-pr10a2-router-player`. Base: `feat/learn-mode-pr10a-catalog-private`. Tasks: 10.2, 10.3 (and the header selector of 10.1). Specs: song-catalog (router), playback-engine (Play (no sound)), learner-language.

## Chain context

```
feat/learn-mode-pr10a-catalog-private
  ^
feat/learn-mode-pr10a2-router-player    this PR
  ^
feat/learn-mode-pr10a3-dev-server (next)
```

- Start: the catalog links to routes that do not exist yet and the player says "Play" for a song that never sounds. End: the routes parse, the page has one shared translator with a language selector in the header, and a private song says it is silent.
- Follow-up: pr10a3 (dev server), pr11a (the Learn view mounts on `#/learn/<id>`).

## What changes

- `src/ui/router.js`: `parseHash` handles `#/learn/<id>?level=` and `#/practice`, `#/practice/<id>`; the id is the raw decoded text (shown only through text nodes). A route with no view (practice, until pr6c) falls to "Page not found".
- `src/ui/transport.js`: `playLabel({ silent, t })`; the play button reads "Play (no sound)" (Spanish "Reproducir (sin sonido)") while the engine reports the song as silent, also after a `play()` that returns `{ silent: true }`, and follows the language.
- `src/ui/player.js`: passes the translator to the transport and the level selector, and shows "The app does not play this song. It only tells you what to play." above the stage of a silent song.
- `src/ui/level-select.js`: level labels and descriptions accept LocalizedText. Found in the browser: the private song showed `[object Object]` as its level chip.
- `src/main.js`: one translator (storage errors tolerated) shared by the catalog and the player; the language selector sits in the header.
- `styles/app.css`: card actions, secondary button, Private chip, header row.
- `tests/score/fake-dom.js`: elements gain `dataset`.

## Browser check (task 10.5, port 8790, headless Chrome with GPU flags)

- (a) With the private library: the catalog lists Chopin and Cancer first, then Cancer (Private) with the "Private" chip, the line that the app does not play it, and "Aprender" / "Tocar junto a la cancion (sin sonido)" (Spanish browser). Screenshots read: `lm10-catalog-1440`, `lm10-catalog-390`.
- (b) With `NO_PRIVATE=1`: only the two public cards, no word "private" in the page, the console shows only the expected 404 of `songs-private/index.json` (twice: catalog and player each ask); the deep link to the private song shows "Song not found". Screenshot: `lm10-catalog-noprivate-1440`.
- (c) Play along on the private song: the button reads "Play (no sound)", the cursor moves (bar 1 beat 1 to beat 4 in 2 s), the silent note is shown. Audible silence itself is covered by the engine tests (zero `playNote` calls); it was not measured with a microphone. Screenshot: `lm10-playalong-private-1440`.
- (d) `#/learn/cancer-private` still shows "Page not found" until pr11a.

## Counter-proofs

- The public song's play button stays "Play" before and after pressing it; a `play()` that reports silent relabels it.
- Malformed learn and practice paths stay unknown; a hostile learn id is inert text and not a valid id.
- A LocalizedText level label never renders as `[object Object]`.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/*.test.js`: all pass |
| Full suite | `node --test`: 1210 tests, 1210 pass, 0 fail |
| Runtime harness | Browser 8790 as listed above |
| Rollback boundary | router, transport, player, level-select, main, the CSS block, `tests/ui/transport-silent.test.js` |

## Review budget

233 authored changed lines including tests, plus this description.
