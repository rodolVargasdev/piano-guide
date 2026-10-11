// Scene facade. createScene() resolves to a working 3D scene, or to a null scene with the same
// interface and a short message in the container when three.js or WebGL is unavailable, so the
// score, transport and audio keep working. Nothing here imports three.js statically: the
// heavy modules load only after the page confirmed it can.
import { fittedRange } from "../core/keyboard-layout.js";
import { createCameraDirector } from "./camera-director.js";
import { createKeyState, updateKeyState } from "./key-state.js";
import { tierSettings, initialTier } from "../core/quality.js";
import { createWatchdog } from "./quality.js";

export const UNAVAILABLE_MESSAGE = "3D view unavailable on this device";

const ALL_VISIBLE = Object.freeze({ L: { muted: false, hidden: false }, R: { muted: false, hidden: false } });

/** Same interface as the real scene; every method is a no-op. `available` tells them apart. */
export function nullScene() {
  return {
    available: false,
    setTimeline() {},
    setHandModes() {},
    setRange() {},
    highlightNotes() {},
    setReducedMotion() {},
    setQuality() {},
    qualityInfo: () => ({ tier: "n/a", auto: true, section: -1, tween: false }),
    animating: () => false,
    render() {},
    resize() {},
    dispose() {},
  };
}

function showMessage(container, doc, text) {
  const p = doc.createElement("p");
  p.className = "meta";
  p.setAttribute("role", "status");
  p.textContent = text;
  container.replaceChildren(p);
}

/**
 * createScene(container, { timeline, loadThree, doc }) never rejects.
 * `loadThree` is injectable so the failure path can be tested without a browser.
 */
export async function createScene(container, { timeline, loadThree = () => import("three"), doc = document } = {}) {
  let stage = null;
  let keyboard = null;
  let notes = null;
  let markers = null;
  try {
    await loadThree();
    const [{ createStage }, { createKeyboard }, { createFallingNotes }, { createMarkers }] = await Promise.all([import("./stage.js"), import("./keyboard.js"), import("./falling-notes.js"), import("./markers.js")]);
    stage = createStage(container);
    const keys = createKeyState();
    let current = timeline;
    let range = null; // null means fitted to the level
    let handModes = ALL_VISIBLE;
    let size = { w: 0, h: 0 };
    let outlined = []; // MIDI keys the lesson card asked to outline
    let reduced = false; // reduced motion: the shift rings stay steady
    let settings = tierSettings("high"); // the tier in force; a rebuild keeps it
    // Medium on a small or touch device, High elsewhere; the watchdog moves it from there.
    const first = initialTier({ hardwareConcurrency: globalThis.navigator?.hardwareConcurrency, coarsePointer: globalThis.matchMedia?.("(pointer: coarse)")?.matches });
    settings = tierSettings(first);
    function applyTier(tier) {
      settings = tierSettings(tier);
      stage.applyTier(settings);
      keyboard.setGlow(settings.glow);
      notes.setHorizonBars(settings.horizonBars);
    }
    const watchdog = createWatchdog({ initial: first, onTier: applyTier });

    const aspect = () => (size.h > 0 ? size.w / size.h : 1.6);
    let lastTick = 0;
    // One framing per song section; the camera tweens between them (a single cut under reduced motion).
    const director = createCameraDirector({ apply: (pose) => stage.applyPose(pose) });
    const frameCamera = () => director.layout({ timeline: current, range: active, centerX: keyboard.centerX, width: keyboard.width, aspect: aspect() }, lastTick);
    let active = null; // the range the keyboard was built for
    function buildNotes() {
      if (notes) {
        stage.scene.remove(notes.group);
        notes.dispose();
      }
      notes = createFallingNotes({ timeline: current, keyboard, handModes, range: active, bars: settings.horizonBars });
      stage.scene.add(notes.group);
    }
    function build() {
      if (keyboard) {
        stage.scene.remove(keyboard.group);
        keyboard.dispose();
      }
      active = range ?? fittedRange(current.notes);
      keyboard = createKeyboard(active);
      keyboard.setGlow(settings.glow);
      stage.scene.add(keyboard.group);
      stage.fitKeyboard(keyboard.width);
      keys.pressed.fill(0); // a new keyboard starts with every key up
      frameCamera();
      keyboard.highlight(outlined);
      buildNotes();
      buildMarkers();
    }
    // Finger markers follow the keyboard and the timeline; they are drawn last.
    function buildMarkers() {
      if (markers) {
        stage.scene.remove(markers.group);
        markers.dispose();
      }
      markers = createMarkers({ timeline: current, keyboard });
      stage.scene.add(markers.group);
    }
    build();
    stage.applyTier(settings); // the first tier of the session

    const scene = {
      available: true,
      setTimeline(tl) {
        current = tl;
        build();
      },
      setHandModes(modes) {
        handModes = modes ?? ALL_VISIBLE;
        buildNotes();
      },
      /** An inclusive MIDI range { low, high }, or null for the range fitted to the level. */
      setRange(r) {
        range = r;
        build();
      },
      /** Outline these MIDI keys with a neutral color, whatever the playback does; [] clears it. Survives a rebuild. */
      highlightNotes(midis) {
        outlined = Array.isArray(midis) ? midis : [];
        keyboard?.highlight(outlined);
      },
      setReducedMotion(on) {
        reduced = on === true;
        director.setReducedMotion(reduced);
      },
      /** True while the camera is moving between sections: a paused scene must keep asking for frames. */
      animating: () => director.animating(),
      /** A tier name (high, medium, low, minimum) overrides the watchdog; "auto" hands control back to it. */
      setQuality(choice) {
        watchdog.choose(choice);
      },
      /** { tier, auto }: the tier in force and whether the watchdog is the one deciding (debug overlay). */
      qualityInfo: () => ({ tier: watchdog.tier(), auto: watchdog.auto(), ...director.info() }),
      /** Draw the scene at `tick`; with `playing` false no key is lit by playback. */
      render(tick, playing = true) {
        lastTick = tick;
        director.at(tick, performance.now());
        const changed = updateKeyState(keys, current, tick, playing, handModes);
        for (let i = 0; i < changed.length; i += 1) keyboard.setPressed(changed[i], keys.pressed[changed[i]]);
        notes.update(tick);
        markers.update(tick, handModes, reduced);
        stage.render();
        watchdog.frame(performance.now(), playing);
      },
      resize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        size = { w, h };
        stage.setSize(w, h);
        frameCamera();
      },
      dispose() {
        markers?.dispose();
        markers = null;
        notes?.dispose();
        notes = null;
        keyboard?.dispose();
        keyboard = null;
        stage?.dispose();
        stage = null;
      },
    };
    scene.resize();
    return scene;
  } catch {
    markers?.dispose();
    notes?.dispose();
    keyboard?.dispose();
    stage?.dispose();
    showMessage(container, doc, UNAVAILABLE_MESSAGE);
    return nullScene();
  }
}
