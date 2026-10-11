// Scene facade. createScene() resolves to a working 3D scene, or to a null scene with the same
// interface and a short message in the container when three.js or WebGL is unavailable, so the
// score, transport and audio keep working. Nothing here imports three.js statically: the
// heavy modules load only after the page confirmed it can.
import { fittedRange } from "../core/keyboard-layout.js";
import { framePose } from "./camera.js";
import { createKeyState, updateKeyState } from "./key-state.js";

export const UNAVAILABLE_MESSAGE = "3D view unavailable on this device";

const ALL_VISIBLE = Object.freeze({ L: { muted: false, hidden: false }, R: { muted: false, hidden: false } });

/** Same interface as the real scene; every method is a no-op. `available` tells them apart. */
export function nullScene() {
  return {
    available: false,
    setTimeline() {},
    setHandModes() {},
    setRange() {},
    setReducedMotion() {},
    setQuality() {},
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
  try {
    await loadThree();
    const [{ createStage }, { createKeyboard }, { createFallingNotes }] = await Promise.all([import("./stage.js"), import("./keyboard.js"), import("./falling-notes.js")]);
    stage = createStage(container);
    const keys = createKeyState();
    let current = timeline;
    let range = null; // null means fitted to the level
    let handModes = ALL_VISIBLE;
    let size = { w: 0, h: 0 };

    const aspect = () => (size.h > 0 ? size.w / size.h : 1.6);
    let active = null; // the range the keyboard was built for
    function buildNotes() {
      if (notes) {
        stage.scene.remove(notes.group);
        notes.dispose();
      }
      notes = createFallingNotes({ timeline: current, keyboard, handModes, range: active });
      stage.scene.add(notes.group);
    }
    function build() {
      if (keyboard) {
        stage.scene.remove(keyboard.group);
        keyboard.dispose();
      }
      active = range ?? fittedRange(current.notes);
      keyboard = createKeyboard(active);
      stage.scene.add(keyboard.group);
      keys.pressed.fill(0); // a new keyboard starts with every key up
      stage.applyPose(framePose(keyboard.width, aspect()));
      buildNotes();
    }
    build();

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
      setReducedMotion() {},
      setQuality() {},
      /** Draw the scene at `tick`; with `playing` false no key is lit by playback. */
      render(tick, playing = true) {
        const changed = updateKeyState(keys, current, tick, playing, handModes);
        for (let i = 0; i < changed.length; i += 1) keyboard.setPressed(changed[i], keys.pressed[changed[i]]);
        notes.update(tick);
        stage.render();
      },
      resize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        size = { w, h };
        stage.setSize(w, h);
        stage.applyPose(framePose(keyboard.width, w / h));
      },
      dispose() {
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
    notes?.dispose();
    keyboard?.dispose();
    stage?.dispose();
    showMessage(container, doc, UNAVAILABLE_MESSAGE);
    return nullScene();
  }
}
