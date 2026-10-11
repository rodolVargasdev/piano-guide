# PR 22e: catalog hero

- Base branch: `feat/piano-guide-mvp-pr22d-camera-reduced-motion`
- Branch: `feat/piano-guide-mvp-pr22e-catalog-hero`
- Chain: ... -> PR 22d -> **PR 22e (this)** -> PR 22f, PR 22g
- Start: the catalog was two plain cards under a heading. End: a landing page with a CSS-only hero (falling notes over a drawn keyboard), a badge, a call to action and polished cards. Not a numbered task: it is the polish the user asked for in PR 22.
- Out of scope: any change to the song cards' data, the router, or the 3D scene. No new dependency and no three.js on the catalog route.

## Summary

- `src/ui/catalog.js`: `heroModel(entries)` (pure: badge "N songs | N levels" counted over usable songs, the first usable song for the call to action, none when all are unavailable) and `hero(entries)`: badge, one-line heading, one-line lead, a "Start with <song>" button, seven decorative notes and a drawn keyboard (both `aria-hidden`). Level chips carry a per-level class.
- `styles/app.css`: hero with two soft radial glows, the keyboard built from `repeating-linear-gradient` (white keys 2.15 rem, black keys over the five joints), notes animated with a `top` keyframe (7 s loop, staggered, orange right hand and blue left hand), glow on the call to action, card lift and top accent on hover, a page-level radial wash, a two-key mark before the brand, small-screen rules. No inline style anywhere (the page CSP forbids it).
- `index.html`: an inline SVG `data:` favicon (the page asked `/favicon.ico` and got a 404 in every run; `img-src` allows `data:`, `tests/csp.test.js` still passes).
- `tests/ui/catalog.test.js`: `heroModel` counts, singular forms, ignores unavailable songs, no call to action without a usable song (with the counter-case).

## Dependency diagram

```
... -> PR 22d -> [PR 22e, this PR] -> PR 22f
```

## Checks (headless Chrome, real GPU, dev server on 8790; 1440 x 900 and 844 x 390)

- Full suite: 730 pass, 0 fail.
- Screenshots read: `22-catalog-b-catalog-1440x900`, `22-catalog-b-catalog-844x390`, `22-catalog-reduced-motion-1440x900`. A first version put notes over the heading text; moved to the right half and dimmed on a narrow screen.
- Motion: allowed, the notes move (tops differ 1.2 s apart); reduced motion emulated, `animation-name` is `none` and the notes stay where the stylesheet rests them (identical positions 1.2 s apart).
- The catalog requests no three.js; no console error (the favicon 404 is gone).
- Known limits: the cost of the catalog route (all modules and both song files are fetched) is measured in PR 22f; the hero text is English only like the rest of the UI; not checked on Safari or Firefox (the `inset` shorthand and `repeating-linear-gradient` are old features, but this was not verified there).

## Rollback

Revert the commit: the catalog returns to the plain card list.
