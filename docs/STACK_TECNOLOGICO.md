# Technology stack

Every third-party component of Piano Guide, with its exact version, why it is used, the alternative that was rejected, and how its safety was checked. This file is updated in the same commit that adds or changes a dependency.

The application itself has no npm dependency: no `node_modules`, no lockfile. Node is used only to run the built-in test runner (`node --test`) and the dev server.

## Container images

| Component | Exact tag and digest | Where it is used | Why | Rejected alternative |
|-----------|----------------------|------------------|-----|----------------------|
| Node (Alpine) | `node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` | `test` stage of the `Dockerfile` only, never shipped | Runs `node --test` inside the build so the shipped image is the tested build | Host-only tests (the image would not be the tested build); Node inside the runtime image (larger, more attack surface) |
| nginx (Alpine slim) | `nginx:1.30.5-alpine-slim@sha256:32463212baf0e7d91aded2e9b843a4f2b9e017804b8c9d5bae7b51dcef64389c` | Runtime stage, serves the static site as user `nginx` on port 8080 | Small static file server; 1.30 is the current stable line | `nginxinc/nginx-unprivileged` (a second maintainer, not needed because `nginx.conf` already moves pid and temp paths to `/tmp`); `nginx:1.30.5-alpine` (see audit note below) |

Selection notes (checked 2026-10-10 against Docker Hub and nodejs.org):

- Node 24 (Krypton) is the newest line marked LTS in `https://nodejs.org/dist/index.json`; 24.21.0 is its newest patch. Node 26 is not LTS yet.
- nginx 1.30.x is the stable line (1.31.x is mainline); 1.30.5 is its newest patch.
- The digests are the multi-architecture index digests published for those tags on Docker Hub.
- The `-alpine-slim` variant was chosen over `-alpine` because the full variant ships `libxml2` (xslt module), whose advisory CVE-2026-86140 (HIGH) has no fix yet. The site needs none of the extra modules.

### Vulnerability audit

Method: `docker scout cves <image>` (Docker Scout v1.25.0). Date: 2026-10-10.

| Image as pinned (before `apk upgrade`) | Critical | High | Medium | Result |
|----------------------------------------|----------|------|--------|--------|
| `nginx:1.30.5-alpine` | 0 | 6 | 5 | Rejected: includes unfixed HIGH CVE-2026-86140 (libxml2) |
| `nginx:1.31.6-alpine` | 0 | 6 | 5 | Rejected: same unfixed libxml2 advisory |
| `nginx:1.30.5-alpine-slim` | 0 | 2 | 0 | Both HIGH have an Alpine fix (see below) |
| `node:24.21.0-alpine` | 0 | 9 | - | Build stage only; see below |

Fixed-in-Alpine advisories on the pinned slim image: CVE-2026-85091 (zlib, fixed in 1.3.2-r1) and CVE-2026-103111 (pcre2, fixed in 10.49-r0). The `Dockerfile` runs `apk upgrade --no-cache` right after the pinned base so these fixes are applied.

Node image: the HIGH advisories were zlib CVE-2026-85091 (fixed by `apk upgrade`) and eight advisories in packages bundled with npm (`brace-expansion`, `tar`, `undici`, `http-cache-semantics`, `ip-address`). The test stage never runs npm and is not shipped, so the `Dockerfile` deletes npm, npx and its bundled packages from that stage.

Result on the built images (after `apk upgrade`, npm removed), `docker scout cves` on 2026-10-10:

| Built image | Critical | High | Medium | Low |
|-------------|----------|------|--------|-----|
| `piano-guide` (final, shipped) | 0 | 0 | 0 | 0 |
| `piano-guide` test stage (`--target test`) | 0 | 0 | 0 | 0 |

Unfixed advisories accepted: none. Because the result depends on the Alpine package index at build time, the audit is repeated on the final image in the last PR of the chain, and again whenever the pinned digests change.

### Final audit (last PR of the chain, PR 22g)

Date: 2026-10-10 (local time; the container clock reads 2026-10-11 UTC). Both images were built from a clean clone of the repository at commit `552f148` (`docker build`, whose test stage ran `node --test` inside the build), then scanned with `docker scout cves` (Docker Scout v1.25.0, a newer 1.26.0 exists and was not needed):

| Image | Digest (short) | Packages indexed | Critical | High | Medium | Low | Result |
|-------|----------------|------------------|----------|------|--------|-----|--------|
| `piano-guide` final, shipped | `52bde68f6c35` | 26 | 0 | 0 | 0 | 0 | No vulnerable package detected |
| `piano-guide` test stage (`--target test`) | `b12f8366fda0` | 27 | 0 | 0 | 0 | 0 | No vulnerable package detected |

The commit that records this section changes only documentation, which is not copied into the shipped image (the test stage copies this file only for the vendor hash guard). Unfixed advisories accepted: none.

Changes to the container configuration since the first audit: `nginx.conf` now enables `gzip` for JavaScript, JSON, CSS and SVG (a built-in nginx directive, no module and no new component). No dependency, image or library was added in PR 19 to PR 22: the Chopin data is content (see below), the finger markers, the stage reflections (`PMREMGenerator`) and the catalog hero use code already in the repository or in the vendored three.js core build, and the score glyphs are hand-drawn SVG paths.

## Front-end libraries

| Component | Exact version | Where it is used | Why | Audit | Status |
|-----------|---------------|------------------|-----|-------|--------|
| three.js | 0.186.1 (vendored under `assets/vendor/`, core build only, no addons) | 3D keyboard scene, loaded lazily by the player through the import map | Renders the keyboard and falling notes | OSV query, SHA-256 of both files | In use from PR 11 |

### three.js (vendored)

- Files and SHA-256, computed on the copies in this repository on 2026-10-10 (they match the values recorded for the audited copy in the portfolio):

  | File | SHA-256 |
  |------|---------|
  | `assets/vendor/three.module.min.js` | `3bc833fceb6577bd1a380388f832ae61cd6e2f78ad02b0bf0d5adf5a4a9334fe` |
  | `assets/vendor/three.core.js` | `3b346151f65ffdfca3e4c002bd58966b78c423087fb48a873f83200de1bffc48` |

- Source: the same copy already audited in the portfolio site (`portafolio-site/assets/vendor/`), a jsDelivr build of `three@0.186.1` (`build/three.module.js` and `build/three.core.js`, minified with Terser). `three.module.min.js` imports `./three.core.js`, so both files travel together.
- Why vendored: a CDN import would add a runtime third party; the import map points at `./assets/vendor/three.module.min.js`.
- Rejected alternatives: CDN import (runtime third party); vendoring the `examples/jsm` addons (more files to audit; the scene uses the core build only); Babylon.js or raw WebGL (weight and effort); a canvas-2D-only keyboard (no 3D reflections or perspective).
- Audit: OSV query `POST https://api.osv.dev/v1/query` with package `three`, ecosystem `npm`, version `0.186.1`, run on 2026-10-10: HTTP 200, empty result (`{}`), so no advisory is published for this version on that date. Re-run on 2026-10-10 in the last PR of the chain: HTTP 200, empty result (`{}`) again. Re-run whenever the version changes.
- Unfixed advisories accepted: none.
- Integrity guard: `tests/vendor.test.js` fails if either file changes by one byte or if the hashes above disappear from this document; `.gitattributes` marks `assets/vendor/*` as `-text` so line-ending conversion can never alter the hashed bytes. The portfolio's own stack document prints the core hash with an extra leading character (65 characters); the 64-character value above is the one computed here.

## Audio assets

| Component | Exact version | Where it is used | Why | Audit | Status |
|-----------|---------------|------------------|-----|-------|--------|
| Salamander Grand Piano (subset, 30 MP3 files) | The Tone.js audio copy, folder `salamander/`, fetched 2026-10-11 (the hosted README names the V2 lineage of the set; the original V3 is on archive.org item `SalamanderGrandPianoV3`) | `assets/audio/piano/`, loaded lazily by `src/audio/sampler.js` through `src/audio/voice.js` | Gives the learner and Listen a real piano timbre; the oscillator synthesizer stays as the automatic fallback | Static audio, no code: N/A (no CVE or GHSA applies to audio data; the hashes below pin the bytes) | In use from PR pr3b-sampled-piano |

### Salamander Grand Piano (samples)

- Author: Alexander Holm. Name: "Salamander Grand Piano".
- Source URL: `https://tonejs.github.io/audio/salamander/` (the same files are in the GitHub repository `Tonejs/audio`, folder `salamander/`). Downloaded on 2026-10-11 with Node `fetch`; the size of each file was compared with its `Content-Length` and the total with the HEAD measurement taken before the download.
- License: Creative Commons Attribution 3.0 Unported (CC BY 3.0), `https://creativecommons.org/licenses/by/3.0/`. Attribution is required. The credit line shown in the footer of every page (both languages) and in the README is: "Piano: Salamander Grand Piano by Alexander Holm, CC BY 3.0, subset converted to MP3, via tonejs.github.io/audio". The license text with the author, the source and the selection is in `assets/audio/piano/LICENSE.txt`, beside the files. The files are used unchanged from the Tone.js copy (which is itself a subset converted to MP3 from the original); nothing was re-encoded here.
- Approval: the owner approved adding this set in the chat on 2026-10-11 (the STOP gate of task 15.1).
- Selection: one velocity layer, 30 files, one sample every minor third (A0, C1, Ds1, Fs1, A1, ... A7, C8; Ds and Fs stand for D sharp and F sharp). The playback rate moves a sample at most 1.5 semitones (the code accepts up to 3). Total size 2,012,677 bytes (about 1.9 MiB), measured on 2026-10-11; the largest file is `Ds1.mp3` (120,625 bytes), the smallest `A7.mp3` (18,730 bytes). Decoded in memory the 30 files are 422 seconds of stereo audio at 48 kHz, about 155 MiB of PCM (measured in Chrome on 2026-10-11): not measured on a phone; a file that fails to decode is covered by the synthesizer for those notes (tested with a fake context, not on a real low-memory device).
- Format: MP3, which `decodeAudioData` decodes in the current Chrome, Edge, Firefox and Safari. Checked here only in Chrome (see the PR notes); the other three are not tested on this machine.
- Rejected alternatives: FluidR3_GM as a MIDI.js soundfont (one 1.8 MB base64 blob in a script file, a weaker piano timbre, and it needs its own runtime); synthesis only (sounds artificial, which was the complaint; it stays as the fallback); Tone.js `Sampler` (an npm runtime library, the project has none).
- Vulnerability check: N/A, static audio with no code. If the files are ever replaced the hashes below must change in the same commit.
- Guards: `tests/assets-guard.test.js` fails if an audio file under `assets/` is missing from this document (name and SHA-256) or if `assets/audio/piano/manifest.json` disagrees with the bytes on disk. `.gitattributes` marks `assets/audio/**` as `-text` so line-ending conversion can never alter the bytes.
- Files, size in bytes and SHA-256, computed on the copies in this repository on 2026-10-11 (MIDI numbers: A0 is 21, middle C is 60, C8 is 108):

  | File | MIDI | Bytes | SHA-256 |
  |------|------|-------|---------|
  | `A0.mp3` | 21 | 113969 | `f62d50bd977679e1316063866ece754604b8c214d73b7e3033372c75d9064c03` |
  | `C1.mp3` | 24 | 110199 | `caba05f0be4d9f6030adcc033208b49ac54e47d58edc57b743085b095b4ea395` |
  | `Ds1.mp3` | 27 | 120625 | `1c02b816b85d2fa938815fdf04d7d327ff20068f1aadc3c97052144c735afa0c` |
  | `Fs1.mp3` | 30 | 115010 | `5cbb51d2a0a55a9ef3656671ca72e336856813949055bb6c189cf990655335cf` |
  | `A1.mp3` | 33 | 115061 | `17fa1e363f9fad67c3357be54a6defc4fca5a5c2aada21de84b30254f9cb2f5b` |
  | `C2.mp3` | 36 | 110357 | `7029a9e84f748433bc33d067ee13d37d0b866768f09ae6c7dac8e2e98e1e53ca` |
  | `Ds2.mp3` | 39 | 110796 | `a106cdec93aa4e767e36809fc9cdaa6b92453fb9f18d5fc28ac4eb0f9f239ecd` |
  | `Fs2.mp3` | 42 | 102320 | `dd34c708274eeba35da1fd99fc31ef904e390ff02f6864aefe8a13261f8a8327` |
  | `A2.mp3` | 45 | 81678 | `20601d890f44a3c22499c7b61f52e571795df1fe5a01fac553dded7b6379e1d4` |
  | `C3.mp3` | 48 | 78036 | `bb70dd921d81b3dda561c19b5c029292ae5a6fba1947e364bf274218ce19a9d1` |
  | `Ds3.mp3` | 51 | 78717 | `4fe73ea3f2c59a1dbfb35cff1d9d8a9e38cb12ef39a91a13083729544cdafed5` |
  | `Fs3.mp3` | 54 | 77933 | `960fefd90f56608b7edf958dadfeca893cff5744ab9034d61e419401fe45ce9c` |
  | `A3.mp3` | 57 | 74526 | `8e108fe228e34e32f6b4e61efff732eec53058a9e6f05a8d8e719598b132c4f9` |
  | `C4.mp3` | 60 | 78718 | `689eaa4c2fd7f29a2cc0e386eec462156d523a87d701269e5e2458e66056f4f6` |
  | `Ds4.mp3` | 63 | 73519 | `663e8bb3e2d0fa23a30526dcd7ab0e42609c193c07025647ef46badcf81ec211` |
  | `Fs4.mp3` | 66 | 68219 | `613652f5c96e35736ce6a46bc4ddb6ba1076d1fb16a35a4c22c14e67efdde57c` |
  | `A4.mp3` | 69 | 61148 | `a62df24a2c84cea8d18c1fa8aca7c18c877ba2b76a00a591256fa74d3ce54ac3` |
  | `C5.mp3` | 72 | 68920 | `2f5b0f7422063010fb379e684bfdf2daa3911dcd2251413d79fa2a53029fdc30` |
  | `Ds5.mp3` | 75 | 58179 | `bf71096e653ab7ceca3914b9fd44d8c27fe83c162564c5db34bd06b94eb14b8c` |
  | `Fs5.mp3` | 78 | 51597 | `ed2fdf543274ea72ddd4eb634a16356531a5f4040b2a60d34fb12a5c72cbf22f` |
  | `A5.mp3` | 81 | 45747 | `9e5cee1fe9cf68b7193623d46a27c8956e572c1ff234ca0e11599b556050dec6` |
  | `C6.mp3` | 84 | 28065 | `0d3232edd13ba69fd5caf4a295060ae0fd533b8a1433ae0a038644d70715c907` |
  | `Ds6.mp3` | 87 | 31395 | `eb643014d9f926f1a5f9f51fc4a1ed8c07c6da36ce164d5b221d7b878a53f142` |
  | `Fs6.mp3` | 90 | 26478 | `c584d2b4e96a37b12c920ed3212d149abedf25342389bfdc557b2fac847ab11c` |
  | `A6.mp3` | 93 | 30013 | `b6064a657592c63c03561d2ce1092607c14e1d8091445d50065d0ec819ff6fbc` |
  | `C7.mp3` | 96 | 18963 | `694b512fac99ba7f7290c045d9c18e94724a7ebcc319b937baabc62125814283` |
  | `Ds7.mp3` | 99 | 22136 | `d51f4c51bed719f51e75ad22d5b9ac4b4d1a4749d02ef31ea03696de46fa5e77` |
  | `Fs7.mp3` | 102 | 22709 | `e9ce71e0f7dc39c1d0033d656cf57e3aa8b303127147f194cc92b04e2b648a9f` |
  | `A7.mp3` | 105 | 18730 | `751c0a0acd00bad6e52749063dac56a0def9870242b053c68ab45cbe8d083fc1` |
  | `C8.mp3` | 108 | 18914 | `b4b5f321751b544ee7f0d6d3e3f1ef52873dd4a6aee91ba41e6c8e61e17a084c` |

## Content sources (not code dependencies)

| Content | Source | License | Where it is credited | Note |
|---------|--------|---------|----------------------|------|
| Notes of the Nocturne in E-flat major, Op. 9 No. 2 (the whole piece: the pickup and bars 1 to 34) | Mutopia Project piece 1590, Mutopia-2014/12/18-1590 (`https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590`), read from the LilyPond file, SHA-256 `f35863a752f5b2805cd50272909b06bb8b1b1a8412d2b549fd13969a4481ab65`, and checked against the MIDI file LilyPond makes from it, SHA-256 `e202d3941ce5f26397f57f59f0e2e4e3ad9e19061fa3c4dc596c5ee6a6a2548e`, accessed 2026-10-11 | CC BY-SA 3.0 | The song's `sources`, the Original lesson's arrangement note and the README | The share-alike term may reach the derived data (`songs/chopin-nocturne-op9-no2.json`). Owner decision (2026-10-11): the code is MIT (`LICENSE`) and this one file is CC BY-SA 3.0 with its attribution in `songs/LICENSE-chopin-nocturne-op9-no2.md`. The notes were read with a throwaway parser that is not kept in the repository; `tests/fixtures/mutopia-chopin-op9n2-onsets.json` pins every onset of both hands from the MIDI file (406 right-hand and 396 left-hand onset groups and 15 grace notes), so the data cannot drift from the source. |
| Notes of Ode to Joy (right hand, the soprano voice) | Mutopia Project piece 528, Mutopia-2009/08/05-528 (`https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528`), read from the LilyPond file `ode.ly`, SHA-256 `a0c865aa9f71221605362622d281405071e0734540e86ce131131757cc803a71`, accessed 2026-10-11 | Public Domain (dedicated by the typesetter) | The song's `sources`, `songs/LICENSE-ode-to-joy.md` and the README | No share-alike term. The left hand (one whole note per bar) is an original arrangement written for this project, not from that page. |
