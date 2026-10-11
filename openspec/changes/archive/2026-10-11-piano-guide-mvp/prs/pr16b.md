# PR 16b: Practice panel and player wiring

- Base branch: `feat/piano-guide-mvp-pr16a-practice-controller`
- Branch: `feat/piano-guide-mvp-pr16b-practice-panel`
- Chain: ... -> PR 16a -> **PR 16b (this)** -> PR 17a
- Start: the controller exists with no UI. End: the player shows the practice panel under the transport and every control works. Tasks 16.1 to 16.3 are checked here.
- Out of scope: chords, lesson card (PR 17), a second Cancer level (PR 18), the effect of the quality selector (PR 22).

## Summary

- `src/ui/practice-panel.js`: Set A here, Set B here, Bar and Beat snap, "Loop a section", Loop, Ramp from, by, to, Ramp, Hold, Mute and Hide per hand, Full 88, Quality. It redraws on every controller change.
- `src/ui/player.js`: the practice effects fan out to the engine (loop, BPM, hands), scene (hands, range), score (hands) and transport (message, BPM field through the new `transport.syncBpm()`); `engine.on("loop-pass")` feeds the ramp; a scene that finishes loading later receives the current hands and range. The temporary Full 88 button of the debug overlay is removed.
- `src/ui/practice-controller.js` (PR 16a file): Set A after a finished range starts a new one. Found in the browser: with a loop active the playhead cannot leave it, so B could never be moved outward.
- `styles/app.css`, `README.md` (Practice tools section), 3 task lines.

## Dependency diagram

```
... -> PR 16a -> [PR 16b, this PR] -> PR 17a -> PR 17b
```

## Size

About 320 authored lines of code, tests, CSS and README plus this description.

## Checks (headless Chrome over the DevTools protocol, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 566 pass, 0 fail. Counter-proof: removing the "new range" line fails 1 test.
- Loop seam: bar 1 at 240 BPM, 22.5 s, oscillator start times logged: 23 onsets, every gap exactly 1000 ms, 12 oscillators per onset (no gap, no doubled note).
- Inverted A-B shows "Bar 2, beat 1 to bar 2, beat 4" (swapped). Ramp 200, step 10, target 230 on the Intro loop: 200, 210, 220, 230; Hold froze 230 over about 3 passes and releasing it reached 240. Without a loop: "Needs a loop", ramp off, BPM unchanged.
- Hands: right muted over many wraps and after a seek leaves only the bass (82 Hz and its partial); left muted leaves 330 Hz and up; both muted with the metronome leaves only 1000 and 1500 Hz and shows "Both hands muted". Hide right: 0 right noteheads in the score (11 left), falling notes in the scene are left-hand only; seeking keeps it; unhiding restores 33.
- Full 88 reframes the keyboard. No console errors. Screenshots read: `16-panel-initial`, `16-needs-loop`, `16-both-muted`, `16-hide-right`, `16-full88`, `16-fitted` at both sizes. At 844 x 390 the transport stays on screen and the panel sits below it.
- Not checked: listening to the audio, a level switch with two real levels (PR 18), a real phone. Editing "Ramp from" above the current "to" swaps the two (spec rule), so set "to" first.

## Rollback

Remove `src/ui/practice-panel.js` and the practice wiring in `src/ui/player.js` (and `syncBpm`); the controller from PR 16a stays inert.
