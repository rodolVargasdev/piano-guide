# PR 7: Cancer Beginner data

- Base branch: `feat/piano-guide-mvp-pr6-practice`
- Branch: `feat/piano-guide-mvp-pr7-cancer-beginner`
- Chain: tracker -> ... -> PR 6 -> **PR 7 (this)** -> PR 8 -> PR 9
- Start: the schema validator and the catalog exist. End: the catalog lists a real, validated song.
- Out of scope: the Original level, lesson and analysis (PR 17 and PR 18), the player (PR 9).

## Summary

Adds `songs/cancer.json` (Beginner level only), its `songs/index.json` entry and the data tests (tasks 7.1 to 7.5).

Content policy: `contentPolicy: "chords-only"`, no lyrics and no vocal melody anywhere. Key E major, 4/4, default 72 BPM. Beginner: bass note in the left hand, root-position triad in the right hand, one chord per bar, `strictBars`, editorial fingering.

## Sources (read on 2026-10-10, recorded in the data)

| Source | Kind | Used for |
|--------|------|----------|
| https://hooktheory.com/theorytab/view/my-chemical-romance/cancer | user-submitted | Progressions per section; the page also says E major, 4/4, 75 BPM |
| https://en.wikipedia.org/wiki/Cancer_(song) | reference | E major, common time, 70 BPM (cites a Musicnotes listing); no chords |

Progressions as read from the Hooktheory page data: Intro `I V`; Verse `I V vi iv`; Pre-Chorus and Chorus `IV V6/V vi iv ii`; a Bridge `I vi V7/ii ii6 V43/ii` exists and is not used.

## Discrepancy to review

The brief said the verse is `I-V-vi-IV = E B C#m A`. The page lists the fourth chord as lowercase `iv` and tags the verse and the chorus with "Borrowed Chords" (the intro has no such tag). The data therefore uses A minor for `iv` and A major only for the chorus `IV`. This is a reading of a single user-submitted page, not a second confirmation: verse and intro are `medium`, chorus `low`.

Other facts to know: the sources give progressions, not bar counts, so one chord per bar and the 11-bar form (2 intro, 4 verse, 5 pre-chorus and chorus) are editorial (confidence `structure: low`). Tempo: Wikipedia says 70, Hooktheory 75; the default is 72 and the confidence entry notes the 70 to 75 range (the brief said 70 to 80; neither source goes above 75).

`lesson` is an empty map for now (a required key); the lesson is authored in PR 17. The validator reports the expected warning "level has no lesson".

## Dependency diagram

```
... -> PR 6 -> 📍 PR 7 -> PR 8 -> PR 9
```

## Size

About 98 lines of data, 14 of index, 68 of tests, 52 of this description and 10 of task checkboxes: 242 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/songs.test.js`: 9 pass. Full `node --test`: 323 pass, 0 fail.
- Counter-proof: a copy with a `lyrics` string, and a copy with a `melody` role, are both caught by the independent scan and by `validateSong`; mutating the real file's first role to `melody` fails 2 tests; restored.
- `docker build -t piano-guide .` succeeds with the suite inside.
- Headless Chrome on port 8790: the catalog card shows "Cancer", "My Chemical Romance", "E major | 72 BPM" and the `beginner` chip; with the file renamed the card shows "Unavailable" with the 404 reason; restored.
- Not checked: the screen was not looked at in an interactive browser.

## Rollback

Remove `songs/cancer.json`, restore `songs/index.json` to `{ "songs": [] }` and drop the Cancer cases from `tests/songs.test.js`.
