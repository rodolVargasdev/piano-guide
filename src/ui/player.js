// Player view: validates the song on open, resolves a level, creates the engine and runs the ONE
// requestAnimationFrame loop that reads engine.position() once per frame. The 3D scene loads
// lazily (a failed import or no WebGL leaves a message and keeps everything else working); the
// score is a no-op placeholder until its PR. dispose() tears everything down on route change.

import { el } from "./dom.js";
import { loadCatalog } from "./catalog.js";
import { notFoundView } from "./router.js";
import { createTransport } from "./transport.js";
import { resolveLevel } from "../core/timeline.js";
import { createAudio } from "../audio/context.js";
import { createEngine } from "../audio/engine.js";

/** The requested level when the song has it, otherwise the song's default level. */
export function pickLevel(song, requested) {
  return requested && Object.hasOwn(song.levels, requested) ? requested : song.defaultLevel;
}

/** True only for `debug=1` in the page query (`/?debug=1#/song/id`) or in the hash query. */
export function debugRequested(search, hash) {
  const fromHash = String(hash ?? "").split("?", 2)[1] ?? "";
  return [search, fromHash].some((q) => new URLSearchParams(String(q ?? "")).get("debug") === "1");
}

/** Milliseconds of musical time between two drawn positions (about one frame period when healthy). */
export function driftMs(prevSeconds, seconds) {
  return Math.max(0, (seconds - prevSeconds) * 1000);
}

const NOOP_VIEW = Object.freeze({ render() {}, dispose() {} });

// One audio object for the whole page: leaving the player suspends the context, returning resumes it.
let sharedAudio = null;
const defaultMakeEngine = () => createEngine({ audio: (sharedAudio ??= createAudio()) });

function createDebugOverlay() {
  const element = el("p", { class: "debug", "aria-hidden": "true" }, "debug");
  let prevTs = null;
  let prevSeconds = 0;
  let worst = 0;
  let frames = 0;
  return {
    element,
    update(pos, ts, playing) {
      const dt = prevTs === null ? 0 : ts - prevTs;
      if (playing) worst = Math.max(worst, driftMs(prevSeconds, pos.seconds));
      prevTs = ts;
      prevSeconds = pos.seconds;
      frames += 1;
      if (frames % 10 === 0) {
        element.textContent = `drift max ${worst.toFixed(1)} ms | frame ${dt.toFixed(1)} ms | tier n/a`;
        worst = 0;
      }
    },
  };
}

const SCENE_UNAVAILABLE = "3D view unavailable on this device";
const defaultLoadScene = () => import("../scene/index.js");

/**
 * playerView({ load, makeEngine, win, loadScene }) returns a router view (route, root) => { dispose() }.
 * The dependencies are injectable so the view can run against fakes. `loadScene` resolves to the
 * scene module ({ createScene }); a rejection leaves the message and the null scene.
 */
export function playerView({ load = loadCatalog, makeEngine = defaultMakeEngine, win = window, loadScene = defaultLoadScene } = {}) {
  return (route, root) => {
    let disposed = false;
    let session = null;
    root.replaceChildren(el("p", { class: "meta", role: "status" }, "Loading song"));

    load().then(({ error, entries }) => {
      if (disposed) return;
      const found = entries.find((e) => e.entry.id === route.songId);
      if (error || !found) {
        if (error) root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, "Song list could not be loaded"), el("p", { class: "meta" }, error.reason), backLink()));
        else notFoundView("Song not found")(route, root);
        return;
      }
      if (found.status !== "ok") {
        root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, "This song is unavailable"), el("p", { class: "meta" }, found.reason), backLink()));
        return;
      }
      session = mount(found.song);
    });

    function mount(song) {
      const levelId = pickLevel(song, route.level);
      const timeline = resolveLevel(song, levelId);
      const engine = makeEngine();
      engine.setTimeline(timeline);

      const debug = debugRequested(win.location.search, win.location.hash) ? createDebugOverlay() : null;
      const score = NOOP_VIEW;
      let scene = NOOP_VIEW;
      let raf = null;
      let closed = false;

      function frame(ts) {
        raf = null;
        const pos = engine.position(); // the only read of the audio clock per frame
        transport.update(pos);
        score.render(pos.tick);
        scene.render(pos.tick, engine.isPlaying());
        debug?.update(pos, ts, engine.isPlaying());
        if (engine.isPlaying()) requestFrame();
      }
      function requestFrame() {
        if (raf === null && !closed) raf = win.requestAnimationFrame(frame);
      }

      const transport = createTransport({ engine, timeline, onChange: requestFrame });
      const key = `${song.key.tonic} ${song.key.mode}`;
      const sceneSlot = el("div", { class: "slot", "data-slot": "scene" }, el("p", { class: "meta", role: "status" }, "Loading keyboard view"));
      const onResize = () => {
        scene.resize();
        requestFrame();
      };
      root.replaceChildren(
        el(
          "section",
          { class: "player" },
          el(
            "div",
            { class: "player-head" },
            el("div", {}, el("h2", {}, song.title), el("p", { class: "meta" }, `${song.composer} | ${key} | ${song.meter.num}/${song.meter.den}`)),
            el("span", { class: "chip" }, timeline.label),
            el("a", { class: "button", href: "#/" }, "Catalog"),
          ),
          el(
            "div",
            { class: "stage" },
            sceneSlot,
            el("div", { class: "slot", "data-slot": "score" }, el("p", { class: "meta" }, "Score view not available yet")),
          ),
          transport.element,
          debug?.element,
        ),
      );
      win.addEventListener("resize", onResize);
      requestFrame();

      // Lazy scene: the catalog never downloads three.js. Any failure keeps the rest of the player alive.
      (async () => {
        try {
          const { createScene } = await loadScene();
          const created = await createScene(sceneSlot, { timeline });
          if (closed) {
            created.dispose();
            return;
          }
          scene = created;
        } catch {
          if (closed) return;
          sceneSlot.replaceChildren(el("p", { class: "meta", role: "status" }, SCENE_UNAVAILABLE));
        }
        requestFrame();
      })();

      return {
        dispose() {
          closed = true;
          win.removeEventListener("resize", onResize);
          if (raf !== null) win.cancelAnimationFrame(raf);
          raf = null;
          scene.dispose(); // frees geometry, materials, textures and the renderer
          transport.dispose();
          engine.dispose(); // stops audio, releases voices and suspends the context
        },
      };
    }

    return {
      dispose() {
        disposed = true;
        session?.dispose();
        session = null;
      },
    };
  };
}

function backLink() {
  return el("a", { class: "button", href: "#/" }, "Back to the catalog");
}
