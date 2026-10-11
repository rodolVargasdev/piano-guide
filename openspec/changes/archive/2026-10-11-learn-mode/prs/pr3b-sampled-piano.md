# PR 3b: Sampled piano

Branch: `feat/learn-mode-pr3b-sampled-piano`. Base: `feat/learn-mode-pr9c-practice-docs` (appended at the end of the chain: the STOP gate was approved after Milestone C was built). Tasks: 15.1 to 15.8. Specs: playback-engine (sampled voice with synthesizer fallback), project rules (dependency announcement, stack document in the same commit, vulnerability check). `size:exception` recommended: 1076 changed lines, of which 189 are the generated manifest and 52 the stack document, and the 30 binary samples (2,012,677 bytes) are not counted.

## Chain context

```
feat/learn-mode-pr9c-practice-docs
  ^
feat/learn-mode-pr3b-sampled-piano           this PR (current)
```

## Approval and what enters

The owner approved the Salamander Grand Piano samples in chat on 2026-10-11. What: 30 MP3 files, one velocity layer, one sample every minor third from A0 to C8 (the names use Ds and Fs for sharps), so no key is more than 1.5 semitones from a sample. Why: the complaint is that the oscillator voice does not sound like a piano; the synthesizer stays as the fallback. Source: `https://tonejs.github.io/audio/salamander/` (same files as the GitHub repository `Tonejs/audio`, folder `salamander/`), downloaded on 2026-10-11. Author: Alexander Holm, "Salamander Grand Piano" (the hosted README names the V2 lineage; the original V3 is on archive.org, item `SalamanderGrandPianoV3`). License: CC BY 3.0, attribution required. Size: 2,012,677 bytes in total (each file checked against its Content-Length). Rejected alternatives: FluidR3_GM as a MIDI.js soundfont (one 1.8 MB base64 blob, weaker timbre, needs a runtime), synthesis only, Tone.js `Sampler` (an npm runtime library). Vulnerability check: N/A, static audio with no code. The per-file SHA-256, the source, the license and the alternatives are in `docs/STACK_TECNOLOGICO.md`, in the same commit as the files.

## What changes

- `assets/audio/piano/`: the 30 MP3 files, `manifest.json` (file, MIDI note, bytes, SHA-256) and `LICENSE.txt` (author, source, selection, license, credit line). `.gitattributes` marks `assets/audio/**` as `-text`.
- `src/audio/sampler.js`: `createSampler(ctx, { manifest, baseUrl, fetch })`; lazy `load()` (middle of the keyboard first, idempotent, a failed file is marked failed and never retried), pure `nearestSample(midi, points)`, `playbackRate = 2 ** ((midi - sample) / 12)`, `playNote`, `startHeld`, `releaseHeld`, `releaseAllHeld`, `cancelPending`, `activeCount`, release by gain ramp, a voice cap of 48.
- `src/audio/voice.js`: `createVoice(ctx)`, the synth interface; per note the nearest decoded sample within 3 semitones, otherwise the oscillator synthesizer. A missing manifest, a missing or corrupt file or blocked requests leave the synthesizer as the only voice, with no error shown. `src/audio/engine.js` uses it by default (`makeSynth = createVoice`); nothing else in the engine changed, so a private song still schedules no note and the learner's own keys use the samples.
- `nginx.conf` (`location ^~ /assets/audio/`, audio types, a year of cache) and `tools/serve.mjs` (`.mp3` and `.m4a` types, `Cache-Control: public, max-age=31536000, immutable` only under `/assets/audio/`).
- `src/ui/credits.js`, `src/main.js`, `src/i18n/strings.js`, `styles/app.css`: a footer on every page with the credit line in both languages and a link to the license file.
- `docs/STACK_TECNOLOGICO.md` (entry), `README.md` (the voice and the credit).
- Tests: `tests/audio/sampler.test.js`, `tests/audio/voice.test.js` (including the whole engine with a public and a private song), `tests/assets-guard.test.js` (every audio file listed with its name and hash, manifest against the disk, license file; with counter-proofs), `tests/ui/credits.test.js`, `tests/serve.test.js` (audio type and cache headers, nginx block, with counter-proofs), `tests/audio/fake-audio.js` (buffer sources and `decodeAudioData`).

## Checks

- `node --test`: 1686 tests, 0 fail (1653 before this PR).
- `docker build -t piano-guide .` exits 0 (built with `--no-cache`); the test stage ran 1686 tests, 1663 pass, 0 fail, 23 skipped (the previous 22 plus the dev-server audio test, which needs `tools/`). A container on port 8792 (stopped afterwards): `A0.mp3` 200 `audio/mpeg` with `max-age=31536000`, `manifest.json` 200 `application/json`, `LICENSE.txt` 200 `text/plain`, `index.html` 200 with `no-cache`.
- Browser check on the dev server (port 8791, Chrome headless, 2026-10-11): the 30 files answer 200 as `audio/mpeg` with the immutable cache header and all 30 decode (3.88 to 25 s, stereo, 48 kHz); with the real voice every key from MIDI 21 to 108 resolves to a sample once loaded and to the synthesizer before. Ode to Joy: the first Play had 5 sample notes and 2 synthesizer notes (the first ones, before the decode finished), the second Play 7 sample notes and none on the synthesizer. With the sample requests blocked: only the synthesizer sounds (21 oscillators, 0 buffer sources), no error text on the page, no uncaught exception. Learn: the first key press used the synthesizer while the samples loaded, the next presses the samples. A private song: Play ("Play (no sound)") started 0 oscillators and 0 buffer sources over 3 s. The credit is visible at 1440 by 900 and 390 by 844, in both languages.
- NOT verified: that it sounds like a piano and its loudness (the user judges, 28.1 item 4), Firefox and Safari decoding, a phone's memory (about 155 MiB of decoded audio), the loading time on the deployed site.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/audio/sampler.test.js tests/audio/voice.test.js tests/assets-guard.test.js tests/serve.test.js tests/ui/credits.test.js`: all pass |
| Full suite | `node --test`: 1686 tests, 0 fail |
| Runtime harness | the dev server browser check and the Docker container check above |
| Rollback boundary | revert the voice (engine default back to the synthesizer) and delete `assets/audio/`, `sampler.js`, `voice.js`, `credits.js` and the nginx and serve rules; nothing else depends on them |
