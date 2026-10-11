# PR 22g: final documents and the full verification pass

- Base branch: `feat/piano-guide-mvp-pr22f-drift-catalog-cost`
- Branch: `feat/piano-guide-mvp-pr22g-final-docs-verification`
- Chain: ... -> PR 22f -> **PR 22g (this)**. Last PR of the chain. Tasks 22.4 and 22.5 are checked here.
- Out of scope: any feature. A `LICENSE` file was NOT added (pending the owner's decision about the CC BY-SA 3.0 data of the Nocturne).

## Summary

- `docs/STACK_TECNOLOGICO.md`: final audit (two images, `docker scout cves`, 0 critical, 0 high, 0 medium, 0 low on both; OSV query for `three@0.186.1` empty), gzip noted as configuration without a new component, a "Content sources" section (Mutopia piece 1590, CC BY-SA 3.0, the pending licensing decision; Cancer holds chords only).
- `tests/stack-doc.test.js` (5, with a counter-proof) and one `COPY Dockerfile` line in the test stage: every base image of the Dockerfile with its exact tag and digest must appear in the document, the three.js version in the document must equal the vendored file's, audits carry dates, no unfixed advisory is accepted unnamed.
- `README.md`: a final pass (Docker first stays), markers, stage, tiers, camera, glyph limits, a dated performance note.
- A mistake caught by the clean clone: the new guard passed in the working tree and failed inside `docker build` because a Windows checkout gives CRLF; fixed in `552f148` (the read normalizes line endings). This is the reason to build from a clean clone.

## Dependency diagram

```
... -> PR 22f -> [PR 22g, this PR]
```

## Verification Plan of design.md, item by item

Date 2026-10-10; Chrome headless on an RTX 3050 laptop GPU through ANGLE Direct3D 11; dev server on 8790, the image on 8792.

1. `node --test`: 741 pass, 0 fail. With the R8 check "event ends after lengthTicks" disabled in `src/core/schema.js`: 2 failures (its malformed fixture and its counter-proof); restored with `git checkout`, 178 schema tests pass again.
2. Dev server: port 8790 was free (checked first); 8765 and the other containers were not touched.
3. Docker (primary): built from a clean clone at `552f148` (the test stage runs `node --test` inside the build), `docker run` on 8792. `curl -I`: `application/javascript` for `src/main.js`, `src/scene/markers.js` and `assets/vendor/three.module.min.js`, `application/json` for the songs, `text/css`; gzip with `Vary`; `Cache-Control: no-cache` on the song index, one year on the vendored files; the CSP header unchanged. The container and the two test image tags were removed afterwards (a `piano-guide:latest` image from three hours earlier is not mine and was left).
4. Browser:
   - Catalog: two cards with key and BPM (`22-final-catalog-*` and the hero shots); no three.js request; a renamed `cancer.json` leaves one card "Unavailable: File could not be loaded (HTTP 404)" and one working card; a truncated `songs/index.json` shows the alert "Song list could not be loaded: Unexpected end of JSON input" and no card; both files restored and verified.
   - Cancer Beginner at 72 then 50 BPM (scheduled sound, oscillator start times): the bar-to-bar onset gap was 3.333 s at 72 BPM (4 beats of 0.833 s) and 4.800 s at 50 BPM (4 beats of 1.2 s); typing 500 shows 240. Clock jitter 8.5 to 9 ms (PR 22f). Keys, falling notes and cursor read the same engine position in one frame (checked in the earlier PRs); the sound itself was NOT listened to.
   - Pause keeps the position (3641 and 3641 after 0.8 s), resume advances, stop goes to 0, a seek while playing leaves no voice sounding from before it (0 oscillators past their stop), after a pause 0 voices sound; at 240 BPM from near the end the song ends and the position returns to 0 (state stopped).
   - Slow mode: gap 6.667 s (4 beats of 1.667 s); metronome clicks at 1500 Hz (accent) and 1000 Hz; count-in: first note 3.38 s after Play with 4 clicks before it; loop by section seam: 23 onsets, every gap exactly 1000 ms, 12 oscillators each; an inverted A-B is swapped; ramp 200, 210, 220, 230, Hold froze it, released it reached 240; ramp without a loop says "Needs a loop" and leaves 72 (the PR 16 script, re-run).
   - Hands: Cancer: mute left and right change the sounding range, both muted leaves only the 1000 and 1500 Hz clicks with the message, hide right removes the right heads and restores. Chopin, both levels (new here): mute right drops the top of the sounding range (932 to 831 Hz) and 11 oscillators, mute left raises the bottom (78 to 466 Hz), hide right leaves 0 right heads, hide left 0 left heads, both restore.
   - Level switch: paused at bar 4 keeps the tick, 50 BPM, metronome and Mute right (12 ms), the hash changes without a new history entry; playing, the first new onset is 0 ms late at three phases on Cancer and at three phases on the Nocturne; session memory restores Original; Analysis shows 11 roman numerals and 7 callouts with the card section and hides them again; the chord chip E lists "E: E G# B" and outlines its keys, a second click clears it. The unknown-chord and `javascript:` source counter-proofs were run in PR 17 and not repeated here.
   - Nocturne Original: engraved, 12 roman numerals and 13 callouts with no overlap, ornament card with bars, 12/8 beaming; Beginner labelled.
   - Reduced motion emulated and cleared live (PR 22d); CPU throttle (PR 22c): 6x did NOT lower the tier on this machine, 20x did, in order, markers working.
   - WebGL disabled by flags: the scene slot says "3D view unavailable on this device", the score draws 44 heads, and playback runs (state playing, the position moves).
   - Back button from the player: the audio context is suspended and no oscillator starts afterwards. 100 catalog, player, catalog cycles: JS heap after each batch of 10, in KB: 4096, 4978, 5057, 5129, 5205, 5405, 5430, 5466, 5476, 5486, 5504 (growth per batch 79, 72, 76, 200, 25, 36, 10, 10, 18 KB: converging, not flat); 0 canvases left.
   - 844 x 390: no horizontal page scroll on the catalog and on the four player pages (both songs, both levels); the scene canvas is 476 x 142 beside the score; the transport fits the width (vertical scrolling is needed to reach it, as before).
   - Hidden tab for 10 s during playback: the window was minimized (visibility `hidden` then `visible`); the audio clock ran 11.34 s and the position advanced 6537 ticks against 6533 expected from it (4 ticks, 7 ms), so the views resumed at the audio position.
5. Not checked: any listening to the sound; a real phone or tablet; Safari and Firefox; GPUs other than the RTX 3050; a cold cache over a real network; the real lag between sound and picture (a page cannot see it); `prefers-reduced-motion` from a real operating system setting (emulated only); the second-edition cross-check of the Nocturne and its harmonic labels against a published analysis (PR 19 and 20 notes). A test that froze the page lifecycle was discarded: it suspends the audio clock as well, so it did not test a hidden tab (the minimized window did).

## Performance budget of design.md (measured the same day)

| Item | Budget | Measured |
|------|--------|----------|
| Catalog route transfer (no three.js) | under 60 KB | 37.6 KB over 13 requests from the image (gzip); 131 KB on the dev server without compression; was 260 KB before PR 22f |
| App code (`src/`, unminified) | under 200 KB | NOT met: 226.5 KB raw (41 files), 87.7 KB gzip level 6; not trimmed, because shrinking it would mean deleting comments or compressing code, which the budget rules forbid |
| Player first render after the song fetch | under 1.5 s, cold three.js excluded | 194 ms with three.js already loaded; 1,475 ms the first time, including the three.js download from localhost |
| Draw calls | under 20 | 18 on High and Medium, 11 on Low and Minimum |
| Frame time, High, desktop | average under 12 ms, p95 under 16.7 ms | The overlay reports the animation-frame interval, which a 60 Hz display holds at 16.7 ms (average 16.7, p95 16.9): it cannot show the cost of a frame. Main-thread work over 10 s of playback: 113 and 131 ms per second, about 1.9 to 2.2 ms per frame (script about 1 ms); GPU time was NOT measured |
| Frame time, phone landscape (844 x 390) | p95 under 33 ms on Low or Minimum | p95 16.9 ms already on High on this machine; no phone was used |
| Clock jitter (was "drift") | under 20 ms | 8.5 to 9 ms (PR 22f) |
| Scheduler, level switch | no gaps at loop seams; switch under 250 ms | loop seam gaps exactly 1000 ms; first new onset 0 ms late |
| Per-frame allocations in render paths | zero | markers: about 12 bytes per frame (the boxing of one `Math.cos`), nothing per marker; earlier PRs for the rest |
| SVG nodes mounted | under 5000 | 220 (Cancer Beginner) and 433 (Nocturne Original) |

## Success criteria of `proposal.md`, one by one

1. `docker build` and `docker run` serve the site; the catalog lists both songs: met (clean clone, tests pass inside, two cards).
2. Falling notes, key highlights, score cursor and audio in sync at the chosen BPM: met for the scheduled sound and the shared position (items above); not judged by ear.
3. BPM, slow mode, metronome, loop A-B, ramp and hands-separate on both songs: met (hands re-run on the Nocturne here; loop, ramp and metronome on Cancer and the Nocturne in PR 16 and PR 20).
4. Level selector between Beginner and Original without a reload: met on both songs.
5. Each song validates, lists sources and confidence, and has a lesson card per level: met (`tests/songs.test.js`, the card checks).
6. `node --test` for `src/core/` with a negative test that a malformed song is rejected: met (741 pass; breaking R8 fails two tests).
7. With `prefers-reduced-motion`, no camera moves or decorative animation: met under emulation (camera cut, rings static, score stepping per beat, hero notes frozen); not tried with a real system setting.
8. Smooth desktop frame rate; a phone in landscape stays usable: met for the frame interval and the 844 x 390 layout; no real phone, GPU cost not measured.
9. The stack document lists three.js and the nginx image with exact versions and the audit result: met and now guarded by a test.
10. Every PR slice within 400 changed lines or records why: met with recorded overages. PR 3 and PR 4 (about 774 and 900), PR 19b (415) and PR 20c (411) in earlier batches; in this batch PR 22d is 407 (202 of them tests; kept cohesive). Counts, additions plus deletions including the description file: PR 21a 249, PR 21b 220, PR 22a 339, PR 22b 260, PR 22c 250, PR 22d 407, PR 22e 291, PR 22f 199, PR 22g about 250 with this description.

## Rollback

Revert this PR's commits: only documents, one guard test and one Dockerfile line change.
