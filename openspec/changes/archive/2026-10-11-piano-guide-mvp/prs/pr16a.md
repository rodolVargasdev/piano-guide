# PR 16a: Practice controller (loop, ramp, hands)

- Base branch: `feat/piano-guide-mvp-pr15b-level-select-ui`
- Branch: `feat/piano-guide-mvp-pr16a-practice-controller`
- Chain: ... -> PR 15b -> **PR 16a (this)** -> PR 16b
- Start: the pure practice rules exist (PR 6) and nothing drives them from the UI. End: `createPractice` holds the panel state and decides when each rule runs. No DOM, no task is checked here.
- Out of scope: the panel DOM, player wiring, CSS and README (PR 16b).

## Summary

- `src/ui/practice-controller.js`: `createPractice({ timeline, effects, position })` with Set A and B (also from the playhead), bar or beat snap through `normalizeLoop`, loop by section, loop on or off, tempo ramp (`setRampOn` sets the BPM to start, `onPass` steps unless Hold, "Needs a loop" without a loop), mute and hide per hand, Full 88 and manual quality. `formatLoop` always shows the normalized range or "Loop not set".
- Disabling the loop also stops the ramp. Setting a valid range turns the loop on at once.

## Dependency diagram

```
... -> PR 15b -> [PR 16a, this PR] -> PR 16b -> PR 17a
```

## Checks

- `node --test tests/ui/practice-controller.test.js`: 20 pass, 0 fail.
- Counter-proofs by mutation: ignoring Hold fails 1 test; accepting a ramp without a loop fails 1 test; both restored.
- Runtime harness: N/A, pure module (the browser check is in PR 16b).

## Rollback

Remove the controller and its suite; nothing else imports them yet.
