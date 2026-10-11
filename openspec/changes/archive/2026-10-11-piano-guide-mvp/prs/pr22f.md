# PR 22f: honest clock jitter and the catalog route cost

- Base branch: `feat/piano-guide-mvp-pr22e-catalog-hero`
- Branch: `feat/piano-guide-mvp-pr22f-drift-catalog-cost`
- Chain: ... -> PR 22e -> **PR 22f (this)** -> PR 22g
- Start: the overlay's "drift" could not read below 16.7 ms and the catalog route fetched 260 KB (design budget: 60 KB). End: an honest definition of the first, a measured fix for the second. Not numbered tasks: both are findings of the final pass, requested by the orchestrator.
- Out of scope: stack documents, the final scan and the full verification pass (PR 22g). The documentation fix for the PR 22e description is in this PR too (one wrong clause).

## Summary

- `src/ui/player.js`: `driftMs` is replaced by `clockJitterMs(prevSeconds, seconds, prevTs, ts)`: per frame, `|audio advance - frame clock advance|` in ms, null for a seek, a loop wrap, a pause, the first frame or a frame over 250 ms. The overlay prints `clock jitter max`. The old number was the step between two drawn positions, which has a floor of one frame period, so it read 21.3 ms on every healthy run and "failed" a 20 ms budget that nothing violated.
- `design.md` (budget table and verification plan) and `README.md` (overlay description) use the new name and say what it is and is not: not the offset between what is heard and seen (output and display latency are invisible to a page, so no figure is claimed). The spec files never carried the number (only "no accumulated drift" on a hidden tab, a different claim), so they are unchanged.
- `src/ui/router.js`: `lazyView(load, { show })`; `src/main.js` loads the player module only when a song opens. A dispose before the module arrives mounts nothing, a failed load shows a message with a link back. `nginx.conf`: `gzip` for JavaScript, JSON, CSS and SVG.
- Tests: `clockJitterMs` (agreement at 60 and 120 Hz reads 0, 5 ms of difference reads 5 in both directions, nulls, the counter-proof that the old metric read a frame period on a healthy step) and four `lazyView` tests (loading then mount, leave before arrival, failed load and late failure, wired in the router with the dispose order).

## Dependency diagram

```
... -> PR 22e -> [PR 22f, this PR] -> PR 22g
```

## Checks

- Full suite: 736 pass, 0 fail.
- Clock jitter, headless Chrome on the real GPU (RTX 3050, ANGLE d3d11), 1440 x 900, 20 s of playback per song, the largest value of each 10-frame window: Cancer Beginner max 8.8 ms, median 8.5 ms; Nocturne Original max 9.0 ms, median 8.6 ms. Both are well under the 20 ms budget, which is kept and now measures what it says. The audio clock appears to advance in steps of about 9 ms in this browser.
- Catalog route, counted with the Resource Timing `encodedBodySize` of every request on `/`: before 259,825 bytes in 33 requests; after the lazy player 131,028 bytes in 13 requests (dev server, no compression); against the real image (`docker build`, tests pass inside, `docker run` on 8792) with gzip 37,269 bytes in 13 requests, under the 60 KB budget; `curl` on the image: `Content-Type: application/javascript`, `Content-Encoding: gzip` for `schema.js` (21,352 raw to 7,409), `Vary: Accept-Encoding`, the CSP header unchanged. No three.js request. The container and the image tag were removed afterwards.
- The player still opens from a direct link after the change (Cancer sections check: tween and settle).
- Not checked: the transfer on a cold cache over a real network (a local container only); a browser other than Chrome.

## Rollback

Revert the two commits: the overlay returns to the "drift" label, the router to a static import and nginx to no compression.
