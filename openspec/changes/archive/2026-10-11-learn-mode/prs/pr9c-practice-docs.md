# PR 9c: Practice documents and the usability task T5

Branch: `feat/learn-mode-pr9c-practice-docs`. Base: `feat/learn-mode-pr8c3-today-card`. Tasks: 27.1, 27.2. Specs: practice-exercises, project documentation rules. The last PR of Milestone C as built (phase 28, the list of what only the user can verify, is NOT part of this batch).

## Chain context

```
feat/learn-mode-pr8c3-today-card
  ^
feat/learn-mode-pr9c-practice-docs           this PR (📍)
```

## What changes

- `README.md`: a **Practice exercises** section (the Today card, the four groups and the ten exercises, the doc card, a run and its feedback, Listen first, Again, Faster, Next hand and Next key with the four key orders and the circle of fifths, the order of introduction as a suggestion, the metronome and what a "clean run at a tempo" means, the ear drills and how choices unlock, the 10-minute routine and how a day counts, the saved progress and Reset progress, and which fingerings are shown as "Suggested fingering"); the routes table now lists `#/practice` and `#/practice/<id>` with the ten exercise ids.
- `docs/USABILITY_CHECK.md`: T3 (Ode to Joy) and T5 (the routine) are available now; a **T5: the 10-minute routine** section (start from a clean practice progress, read the task once, say nothing else, skipping is allowed and recorded) and what to record for it (which blocks were done or skipped; whether Listen, the metronome or the tempo buttons were used; whether "clean run" and "Suggested fingering" were understood without help; whether "1 day in a row" made sense; whether an ear question was answered by playing it back).
- `tests/docs-guard.test.js`: the protocol guard now requires every task T1 to T5 to be marked available now, the T5 section and its recording fields; the README guard requires the Practice exercises section and its parts, the two routes and the ten exercise ids. Each new guard has its counter-proof on a deliberately broken copy (T3 or T5 marked as waiting, the T5 section renamed, a recording field removed, the section renamed, "Skip block" removed, a route changed, an exercise id renamed).
- No dependency was added (`docs/STACK_TECNOLOGICO.md` is unchanged), no change to the Dockerfile or nginx.

## Docker (27.2)

`docker build -t piano-guide .` exits 0. The test stage ran **1653 tests, 1631 pass, 0 fail, 22 skipped** (the CLI and dev-server tests need `tools/`, and the private-local test needs the private folder; each skips with its reason). A container on port 8795 (stopped and removed afterwards): `/` 200, the practice modules (`/src/practice/routine.js`, `/src/ui/practice-view.js`, `/src/theory/progressions.js`) 200 with the JavaScript type, `/songs/index.json` 200, `/songs/cancer.json` 404, `/songs-private/index.json` 404, `/assets/img/posture.svg` 200 as `image/svg+xml`, and `find /usr/share/nginx/html -path '*songs-private*'` prints nothing.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/docs-guard.test.js`: 4 pass |
| Full suite | `node --test`: 1653 tests, 0 fail |
| Runtime harness | `docker build` and a container check, above |
| Rollback boundary | the README section and route rows, the T5 section and the two availability notes of the usability protocol, the guards of `tests/docs-guard.test.js` |
