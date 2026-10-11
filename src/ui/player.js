// Player view: validates the song on open, resolves a level, creates the engine and runs the ONE
// requestAnimationFrame loop that reads engine.position() once per frame. The 3D scene loads
// lazily (a failed import or no WebGL leaves a message and keeps everything else working); the
// SVG score is created right after the slot is in the page. dispose() tears everything down on
// route change.

import { el } from "./dom.js";
import { loadCatalog } from "./catalog.js";
import { notFoundView } from "./router.js";
import { createTransport } from "./transport.js";
import { resolveLevel } from "../core/timeline.js";
import { createPractice } from "./practice-controller.js";
import { createPracticePanel } from "./practice-panel.js";
import { createLessonCard } from "./lesson-card.js";
import { createLevelSelect, resolveLevelId, controlsFor, readRemembered, remember, mapPosition, updateHash } from "./level-select.js";
import { FULL_RANGE } from "../core/keyboard-layout.js";
import { createAudio } from "../audio/context.js";
import { createEngine } from "../audio/engine.js";
import { createScore } from "../score/render.js";

/** The level to open: the hash level, then the session memory, then the song's default (see level-select.js). */
export const pickLevel = resolveLevelId;

/** True only for `debug=1` in the page query (`/?debug=1#/song/id`) or in the hash query. */
export function debugRequested(search, hash) {
  const fromHash = String(hash ?? "").split("?", 2)[1] ?? "";
  return [search, fromHash].some((q) => new URLSearchParams(String(q ?? "")).get("debug") === "1");
}

/** Milliseconds of musical time between two drawn positions (about one frame period when healthy). */
export function driftMs(prevSeconds, seconds) {
  return Math.max(0, (seconds - prevSeconds) * 1000);
}

const NOOP_VIEW = Object.freeze({ render() {}, dispose() {}, resize() {}, setRange() {}, setHandModes() {}, setTimeline() {}, highlightNotes() {}, setReducedMotion() {}, animating: () => false, qualityInfo: () => ({ tier: "n/a", auto: true }) });

// One audio object for the whole page: leaving the player suspends the context, returning resumes it.
let sharedAudio = null;
const defaultMakeEngine = () => createEngine({ audio: (sharedAudio ??= createAudio()) });

/** Frame statistics over the last 120 frames: { avg, p95 } in milliseconds (debug overlay only). */
export function frameStats(samples) {
  if (samples.length === 0) return { avg: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { avg, p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] };
}

const FRAME_WINDOW = 120;

function createDebugOverlay() {
  const label = el("span", {}, "debug");
  const element = el("div", { class: "debug" }, label);
  let prevTs = null;
  let prevSeconds = 0;
  let worst = 0;
  let frames = 0;
  const dts = [];
  return {
    element,
    update(pos, ts, playing, quality) {
      const dt = prevTs === null ? 0 : ts - prevTs;
      if (playing) {
        worst = Math.max(worst, driftMs(prevSeconds, pos.seconds));
        if (prevTs !== null) {
          dts.push(dt);
          if (dts.length > FRAME_WINDOW) dts.shift();
        }
      } else dts.length = 0;
      prevTs = ts;
      prevSeconds = pos.seconds;
      frames += 1;
      if (frames % 10 === 0 || !playing) {
        const { avg, p95 } = frameStats(dts);
        label.textContent = `drift max ${worst.toFixed(1)} ms | frame avg ${avg.toFixed(1)} p95 ${p95.toFixed(1)} ms | tier ${quality.tier}${quality.tier === "n/a" ? "" : quality.auto ? " (auto)" : " (manual)"} | camera section ${quality.section ?? "n/a"}${quality.tween ? " moving" : ""}`;
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
      let levelId = pickLevel(song, route.level, readRemembered(win.sessionStorage, song.id));
      let timeline = resolveLevel(song, levelId);
      const ui = { names: route.names, view: route.view, analysis: false };
      const engine = makeEngine();
      engine.setTimeline(timeline);

      const debug = debugRequested(win.location.search, win.location.hash) ? createDebugOverlay() : null;
      let score = NOOP_VIEW;
      let scene = NOOP_VIEW;
      let raf = null;
      let closed = false;

      function frame(ts) {
        raf = null;
        const pos = engine.position(); // the only read of the audio clock per frame
        transport.update(pos);
        if (ui.view !== "scene") score.render(pos.tick);
        if (ui.view !== "score") scene.render(pos.tick, engine.isPlaying());
        debug?.update(pos, ts, engine.isPlaying(), scene.qualityInfo());
        if (engine.isPlaying() || scene.animating()) requestFrame(); // a camera move runs on while paused
      }
      function requestFrame() {
        if (raf === null && !closed) raf = win.requestAnimationFrame(frame);
      }

      const transport = createTransport({ engine, timeline, onChange: requestFrame });
      // Practice state (loop, ramp, hands, range) lives in the controller; these effects fan it out.
      // Hand flags are kept by the engine, scene and score, so they survive a seek, a loop wrap and a level change.
      const practice = createPractice({
        timeline,
        position: () => engine.position().tick,
        effects: {
          setLoop: (loop) => {
            engine.setLoop(loop);
            requestFrame();
          },
          setBpm: (n) => {
            engine.setBpm(n);
            transport.syncBpm();
          },
          getBpm: () => engine.getBpm(),
          setHands: (modes) => {
            engine.setHandModes(modes);
            scene.setHandModes(modes);
            score.setHandModes(modes);
            transport.setHandModes(modes);
            requestFrame();
          },
          setRange: (range) => {
            scene.setRange(range);
            requestFrame();
          },
          setQuality: (q) => {
            scene.setQuality(q);
            requestFrame(); // a paused scene redraws only when asked
          },
        },
      });
      const panel = createPracticePanel({ practice, timeline });
      // The lesson card follows the level and the Analysis toggle; its chord chips outline keys on the scene.
      const lessonCard = createLessonCard({
        song,
        onHighlight: (midis) => {
          scene.highlightNotes(midis);
          requestFrame(); // a paused scene redraws only when asked
        },
      });
      const showLesson = () => lessonCard.setLevel(levelId, { analysis: ui.analysis && controlsFor(song, levelId).analysis });
      showLesson();
      const offPass = engine.on("loop-pass", () => practice.onPass());
      const key = `${song.key.tonic} ${song.key.mode}`;
      const sceneSlot = el("div", { class: "slot", "data-slot": "scene" }, el("p", { class: "meta", role: "status" }, "Loading keyboard view"));
      const scoreSlot = el("div", { class: "slot", "data-slot": "score" });
      const replaceHash = (changes) => win.history?.replaceState(null, "", updateHash(win.location.hash, changes));
      const stage = el("div", { class: "stage", "data-view": ui.view }, sceneSlot, scoreSlot);
      const applyMode = () => score.setMode({ names: ui.names, analysis: ui.analysis && controlsFor(song, levelId).analysis });
      const levelSelect = createLevelSelect({
        song,
        state: { levelId, ...ui },
        onLevel: switchLevel,
        onNames: (names) => {
          ui.names = names;
          replaceHash({ names });
          applyMode();
          requestFrame();
        },
        onAnalysis: (on) => {
          ui.analysis = on;
          applyMode();
          showLesson();
          requestFrame();
        },
        onView: (view) => {
          ui.view = view;
          stage.setAttribute("data-view", view);
          replaceHash({ view });
          scene.resize();
          score.resize();
          requestFrame();
        },
      });
      // A level switch keeps the bar and beat, BPM, loop, metronome and hand state; while playing the
      // engine drops pending voices and schedules the new notes from that tick in the same call.
      function switchLevel(id) {
        if (id === levelId || !Object.hasOwn(song.levels, id)) return;
        const next = resolveLevel(song, id);
        engine.setTimeline(next, { tick: mapPosition(engine.position().tick, timeline, next) });
        scene.setTimeline(next);
        score.setTimeline(next, { title: song.title });
        practice.setTimeline(next);
        panel.setTimeline(next);
        timeline = next;
        levelId = id;
        applyMode();
        showLesson();
        levelSelect.update({ levelId });
        remember(win.sessionStorage, song.id, id);
        replaceHash({ level: id });
        requestFrame();
      }
      const onResize = () => {
        scene.resize();
        score.resize();
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
            levelSelect.element,
            el("a", { class: "button", href: "#/" }, "Catalog"),
          ),
          stage,
          transport.element,
          panel.element,
          lessonCard.element,
          debug?.element,
        ),
      );
      win.addEventListener("resize", onResize);
      // The slot must be in the page before the score measures it.
      score = createScore(scoreSlot, { timeline, title: song.title, names: ui.names });
      const motion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
      // Reduced motion follows the system setting live: the score steps per beat and the camera cuts instead of tweening.
      const onMotion = () => {
        score.setReducedMotion(motion.matches);
        scene.setReducedMotion(motion.matches);
        requestFrame();
      };
      if (motion) {
        onMotion();
        motion.addEventListener("change", onMotion);
      }
      requestFrame();

      // Lazy scene: the catalog never downloads three.js. Any failure keeps the rest of the player alive.
      (async () => {
        try {
          const { createScene } = await loadScene();
          const built = timeline;
          const created = await createScene(sceneSlot, { timeline: built });
          if (closed) {
            created.dispose();
            return;
          }
          if (timeline !== built) created.setTimeline(timeline); // the level changed while the scene loaded
          const { hands, full } = practice.state(); // the panel may have changed while the scene loaded
          created.setHandModes(hands);
          created.setReducedMotion(motion?.matches === true); // the preference may have been set before the scene arrived
          if (full) created.setRange(FULL_RANGE);
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
          lessonCard.dispose(); // clears a chord outline while the scene still exists
          win.removeEventListener("resize", onResize);
          motion?.removeEventListener("change", onMotion);
          score.dispose();
          if (raf !== null) win.cancelAnimationFrame(raf);
          raf = null;
          scene.dispose(); // frees geometry, materials, textures and the renderer
          offPass();
          panel.dispose();
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
