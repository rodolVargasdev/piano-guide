// The 2D learn keyboard (SVG): a close, readable slice of the piano with a name on every key, the keys to
// press now shaded with their finger number, and a clear state for pressed, wrong and correct keys.
// Drawn in CSS pixels (the viewBox equals the size on screen), so a font size here is the size the
// learner reads. Geometry comes from core/keyboard-layout.js. Text goes through textContent only.
// No state relies on color alone: shading comes with an outline and a badge, a wrong key with hatching
// and a cross, a correct one with a check mark, a pressed key sits lower.
import { layoutRange } from "../core/keyboard-layout.js";
import { keyboardMetrics, namesFor, spellMidi } from "./keyboard-labels.js";

const NS = "http://www.w3.org/2000/svg";
const DEFAULT_REGION = Object.freeze({ low: 60, high: 74 }); // C4 to D5: nine white keys
export const WRONG_MS = 1200;
export const CORRECT_MS = 700;

/**
 * createLearnKeyboard({ mount, i18n, bus, doc, timers }) -> the keyboard object.
 *   setRegion({ low, high })       the first and last WHITE key shown (MIDI)
 *   setKeyContext(key)             { tonic, mode } or null: how black keys are spelled
 *   setSpellings([{ midi, pitch }]) spellings the data gives; they win over the key context
 *   setStepKeys(keys)              keys to press now, [{ midi, finger, hand }]: shaded, outlined, badge
 *   setPositionKeys(keys)          keys of the hand position, a quiet finger digit
 *   setLetters(Map midi -> text)   the computer key that plays each key
 *   setSounding(midis, hand)       keys lit while a phrase is listened to (no badge)
 *   setHints(midis)                keys to look at, outlined with a dashed line (lesson zero: the groups of black keys)
 *   flashWrong(midi) / flashCorrect(midis)   transient states with a text cue in the live region
 *   fit({ width, height, portrait }) room in pixels; a region wider than the room scrolls sideways (the keys keep their
 *                                  minimum width), centered on the keys to press, with a hint line under the keyboard
 * Pressing on a key (pointer or touch, one pointer per finger) sends noteOn and noteOff to the bus with
 * the source "screen"; any note held on the bus, from any source, shows as pressed.
 */
export function createLearnKeyboard({ mount, i18n, bus = null, doc = globalThis.document, timers = { setTimeout: (f, ms) => globalThis.setTimeout(f, ms), clearTimeout: (id) => globalThis.clearTimeout(id) } }) {
  let region = { ...DEFAULT_REGION };
  let keyContext = null;
  let room = { width: 0, height: Infinity, portrait: false };
  let overflowing = false;
  let total = 0;
  let overrides = new Map(); // midi -> spelled pitch the song gives (E# in F# major)
  let stepKeys = [];
  let positionKeys = [];
  let letters = new Map();
  let sounding = { midis: new Set(), hand: "R" };
  let hints = new Set();
  let pressed = new Set();
  const wrong = new Map(); // midi -> timer
  const correct = new Map(); // midi -> timer

  const make = (tag, attrs = {}, text) => {
    const node = doc.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined && value !== null && value !== false) node.setAttribute(name, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const root = doc.createElement("div");
  root.setAttribute("class", "learn-keyboard");
  const live = doc.createElement("div");
  live.setAttribute("class", "lk-live");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  const svg = make("svg", { class: "lk-svg", role: "group", focusable: "false" });
  root.append(svg, live);
  // The hint sits under the keyboard, outside the scrolling box, so it stays in view while the keys scroll.
  const hint = doc.createElement("p");
  hint.setAttribute("class", "lk-turn-hint meta");
  hint.setAttribute("role", "status");
  hint.hidden = true;
  mount.append(root, hint);

  const keyEls = new Map(); // midi -> rect
  let geom = new Map(); // midi -> { cx, x, w, black }
  let current = null; // metrics and layout of the last render
  let overlay = make("g", { class: "lk-overlay" });

  // ---- pointers -------------------------------------------------------------------------------
  const active = new Map(); // pointerId -> midi
  const holding = (midi) => [...active.values()].filter((m) => m === midi).length;
  function down(event, midi) {
    if (!bus || (event.button !== undefined && event.button !== 0) || active.has(event.pointerId)) return;
    event.preventDefault?.();
    // A touch is captured by the key it starts on; release it so sliding off the key ends the note.
    event.target?.releasePointerCapture?.(event.pointerId);
    active.set(event.pointerId, midi);
    bus.noteOn(midi, { source: "screen" });
  }
  function up(event) {
    const midi = active.get(event.pointerId);
    if (midi === undefined) return;
    active.delete(event.pointerId);
    if (holding(midi) === 0) bus?.noteOff(midi, { source: "screen" });
  }

  // ---- drawing --------------------------------------------------------------------------------
  function render() {
    const lay = layoutRange(region);
    const width = room.width > 0 ? room.width : (mount.clientWidth ?? 0) > 0 ? mount.clientWidth : 600;
    const m = keyboardMetrics({ whiteCount: lay.whites.length, width, height: room.height });
    const lang = i18n.lang();
    total = lay.whites.length * m.keyW;
    overflowing = total > width;
    root.setAttribute("class", overflowing ? "learn-keyboard lk-scrolls" : "learn-keyboard");
    const top = m.stripH;
    keyEls.clear();
    geom = new Map();
    const strip = make("g", { class: "lk-strip" });
    const whites = make("g", { class: "lk-whites" });
    const blacks = make("g", { class: "lk-blacks" });
    const names = (midi) => namesFor({ midi, key: keyContext, pitch: overrides.get(midi) ?? null, lang });
    const bind = (rect, midi) => {
      rect.addEventListener("pointerdown", (e) => down(e, midi));
      rect.addEventListener("pointerup", up);
      rect.addEventListener("pointercancel", up);
      rect.addEventListener("pointerleave", up);
    };
    for (const k of lay.whites) {
      const n = names(k.midi);
      const x = Math.round(k.x * m.keyW);
      const cx = x + m.keyW / 2;
      const rect = make("rect", { class: "lk-key lk-white", "data-midi": k.midi, x, y: top, width: m.keyW, height: m.keyH, rx: 4 });
      bind(rect, k.midi);
      keyEls.set(k.midi, rect);
      geom.set(k.midi, { cx, x, w: m.keyW, black: false });
      whites.append(
        rect,
        make("text", { class: "lk-name lk-name-primary", x: cx, y: top + m.keyH - 8 - m.secondary - 4, "text-anchor": "middle", "font-size": m.primary, "pointer-events": "none" }, n.primary),
        make("text", { class: "lk-name lk-name-secondary", x: cx, y: top + m.keyH - 8, "text-anchor": "middle", "font-size": m.secondary, "pointer-events": "none" }, n.secondary),
      );
    }
    for (const k of lay.blacks) {
      const n = names(k.midi);
      const x = Math.round(k.x * m.keyW);
      const w = Math.round(k.width * m.keyW);
      const cx = x + w / 2;
      const rect = make("rect", { class: "lk-key lk-black", "data-midi": k.midi, x, y: top, width: w, height: m.blackH, rx: 3 });
      bind(rect, k.midi);
      keyEls.set(k.midi, rect);
      geom.set(k.midi, { cx, x, w, black: true });
      blacks.append(rect);
      strip.append(
        make("text", { class: "lk-strip-name lk-name-primary", x: cx, y: m.strip + 2, "text-anchor": "middle", "font-size": m.strip, "pointer-events": "none" }, n.primary),
        make("text", { class: "lk-strip-name lk-name-secondary", x: cx, y: 2 * m.strip + 4, "text-anchor": "middle", "font-size": m.strip, "pointer-events": "none" }, n.secondary),
      );
    }
    const height = top + m.keyH + 4;
    svg.setAttribute("viewBox", `0 0 ${total} ${height}`);
    svg.setAttribute("width", total);
    svg.setAttribute("height", height);
    svg.setAttribute("aria-label", i18n.t("keyboard.label", { low: spellMidi(region.low, keyContext), high: spellMidi(region.high, keyContext) }));
    overlay = make("g", { class: "lk-overlay", "pointer-events": "none" });
    const hatch = make("pattern", { id: "lk-hatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    hatch.append(make("rect", { class: "lk-hatch-bg", width: 8, height: 8 }), make("line", { class: "lk-hatch-line", x1: 0, y1: 0, x2: 0, y2: 8 }));
    const defs = make("defs");
    defs.append(hatch);
    svg.replaceChildren(defs, strip, whites, blacks, overlay);
    current = { lay, m, top };
    paint();
    center();
  }

  // Keys to press that are off screen, or a phone held upright with a keyboard wider than the screen: one line.
  function updateHint() {
    const view = root.clientWidth ?? 0;
    const left = root.scrollLeft ?? 0;
    const off = overflowing && view > 0 && stepKeys.some((k) => geom.has(k.midi) && (geom.get(k.midi).x < left - 1 || geom.get(k.midi).x + geom.get(k.midi).w > left + view + 1));
    hint.textContent = off ? i18n.t("keyboard.scrollHint") : overflowing && room.portrait ? i18n.t("keyboard.turnPhone") : "";
    hint.hidden = hint.textContent === "";
  }

  // Scrolls so the keys to press are in the middle; when they are wider than the screen, the lowest one is put at the left edge.
  function center() {
    const view = root.clientWidth ?? 0;
    const spots = stepKeys.map((k) => geom.get(k.midi)).filter(Boolean);
    if (overflowing && view > 0 && spots.length > 0) {
      const lo = Math.min(...spots.map((g) => g.x));
      const hi = Math.max(...spots.map((g) => g.x + g.w));
      const want = hi - lo <= view - 24 ? (lo + hi) / 2 - view / 2 : lo - 12;
      root.scrollLeft = Math.max(0, Math.min(want, total - view));
    } else if (!overflowing) {
      root.scrollLeft = 0;
    }
    updateHint();
  }

  // Key classes and the overlay (outlines, badges, letters, marks), rebuilt on every state change.
  function paint() {
    const { m, top } = current;
    const expected = new Map(stepKeys.map((k) => [k.midi, k]));
    for (const [midi, rect] of keyEls) {
      const g = geom.get(midi);
      const classes = ["lk-key", g.black ? "lk-black" : "lk-white"];
      if (expected.has(midi)) classes.push("lk-expected", `lk-hand-${expected.get(midi).hand}`);
      else if (sounding.midis.has(midi)) classes.push("lk-sounding", `lk-hand-${sounding.hand}`);
      if (positionKeys.some((k) => k.midi === midi)) classes.push("lk-position");
      if (hints.has(midi)) classes.push("lk-hint");
      if (pressed.has(midi)) classes.push("lk-pressed");
      if (wrong.has(midi)) classes.push("lk-wrong");
      if (correct.has(midi)) classes.push("lk-correct");
      rect.setAttribute("class", classes.join(" "));
      rect.setAttribute("transform", pressed.has(midi) ? "translate(0 2)" : "translate(0 0)");
    }
    const together = new Set(stepKeys.map((k) => k.hand)).size > 1;
    const parts = [];
    const bottomOf = (g) => top + (g.black ? m.blackH : m.keyH);
    const boxH = m.letter + 6;
    const boxW = (label) => Math.max(boxH + 2, label.length * m.letter * 0.7 + 8);
    // On a black key the badge sits above the computer-key letter box, which takes the bottom of the key.
    const badgeY = (g) => (g.black ? bottomOf(g) - (m.letter + 6) - 8 - m.badge / 2 : top + m.blackH + m.badge / 2 + 4);
    // The lower part of a white key holds the finger badge, the computer-key letter box and the names. When it is
    // too short for the badge above the box, the pair goes side by side on a wide key; on a narrow key the box moves to
    // the top of the key, between the black keys; if even that is too narrow the box yields to the badge (null).
    const stacked = m.keyH - m.blackH - (8 + m.secondary + 4 + m.primary) >= m.badge + boxH + 16;
    const freeTop = (g, midi, width) => {
      let lo = g.x;
      let hi = g.x + g.w;
      const left = geom.get(midi - 1);
      const right = geom.get(midi + 1);
      if (left?.black) lo = Math.max(lo, left.x + left.w);
      if (right?.black) hi = Math.min(hi, right.x);
      return hi - lo >= width + 4 ? (lo + hi) / 2 : null;
    };
    const shared = new Map(); // midi -> { badgeDx, boxCx, boxY } | null (the box yields)
    for (const k of stepKeys) {
      const g = geom.get(k.midi);
      const label = letters.get(k.midi);
      if (!g || g.black || !label || stacked) continue;
      const badgeW = together ? m.badge + 10 : m.badge;
      const width = boxW(label);
      if (g.w >= badgeW + width + 10) shared.set(k.midi, { badgeDx: -(width + 4) / 2, boxCx: g.cx + (badgeW + 4) / 2, boxY: badgeY(g) - boxH / 2 });
      else {
        const cx = freeTop(g, k.midi, width);
        shared.set(k.midi, cx === null ? null : { badgeDx: 0, boxCx: cx, boxY: top + 4 });
      }
    }
    // A hint is a dashed outline (not color alone) around a key the learner should look at.
    for (const midi of hints) {
      const g = geom.get(midi);
      if (g) parts.push(make("rect", { class: "lk-hint-outline", x: g.x + 1.5, y: top + 1.5, width: Math.max(0, g.w - 3), height: (g.black ? m.blackH : m.keyH) - 3, rx: 3, fill: "none" }));
    }
    for (const k of stepKeys) {
      const g = geom.get(k.midi);
      if (!g) continue;
      const left = k.hand === "L";
      const label = together ? `${i18n.t(`hand.letter.${k.hand}`)}${k.finger}` : String(k.finger);
      const w = together ? m.badge + 10 : m.badge;
      const cy = badgeY(g);
      const bx = g.cx + (shared.get(k.midi)?.badgeDx ?? 0);
      // The outline: one line for the right hand, a double line for the left.
      parts.push(make("rect", { class: `lk-outline lk-hand-${k.hand}`, x: g.x + 1.5, y: top + 1.5, width: Math.max(0, g.w - 3), height: (g.black ? m.blackH : m.keyH) - 3, rx: 3, fill: "none" }));
      if (left) parts.push(make("rect", { class: `lk-outline lk-outline-inner lk-hand-${k.hand}`, x: g.x + 5, y: top + 5, width: Math.max(0, g.w - 10), height: (g.black ? m.blackH : m.keyH) - 10, rx: 2, fill: "none" }));
      parts.push(
        left
          ? make("rect", { class: `lk-badge lk-badge-L`, x: bx - w / 2, y: cy - m.badge / 2, width: w, height: m.badge, rx: 5 })
          : together
            ? make("rect", { class: `lk-badge lk-badge-R`, x: bx - w / 2, y: cy - m.badge / 2, width: w, height: m.badge, rx: m.badge / 2 })
            : make("circle", { class: `lk-badge lk-badge-R`, cx: bx, cy, r: m.badge / 2 }),
        make("text", { class: "lk-finger", x: bx, y: cy + m.badgeFont * 0.36, "text-anchor": "middle", "font-size": together ? m.badgeFont - 3 : m.badgeFont }, label),
      );
    }
    for (const k of positionKeys) {
      const g = geom.get(k.midi);
      if (!g || expected.has(k.midi)) continue;
      parts.push(make("text", { class: `lk-quiet lk-hand-${k.hand}`, x: g.cx, y: g.black ? badgeY(g) + 5 : top + m.blackH + m.letter + 4, "text-anchor": "middle", "font-size": m.letter }, String(k.finger)));
    }
    for (const [midi, label] of letters) {
      const g = geom.get(midi);
      if (!g || !label || shared.get(midi) === null) continue;
      const side = shared.get(midi);
      const w = boxW(label);
      const y = side ? side.boxY : g.black ? bottomOf(g) - boxH - 4 : top + m.keyH - (8 + m.secondary + 4 + m.primary) - boxH - 4;
      const lx = side ? side.boxCx : g.cx;
      parts.push(make("rect", { class: "lk-letter-box", x: lx - w / 2, y, width: w, height: boxH, rx: 4 }), make("text", { class: "lk-letter", x: lx, y: y + boxH - 5, "text-anchor": "middle", "font-size": m.letter }, label));
    }
    for (const midi of wrong.keys()) {
      const g = geom.get(midi);
      if (!g) continue;
      const cy = top + (g.black ? m.blackH : m.keyH) / 2;
      parts.push(make("text", { class: "lk-mark lk-mark-wrong", x: g.cx, y: cy + m.badgeFont * 0.4, "text-anchor": "middle", "font-size": m.badgeFont + 8 }, "x"));
    }
    for (const midi of correct.keys()) {
      const g = geom.get(midi);
      if (!g) continue;
      const cy = top + (g.black ? m.blackH : m.keyH) / 2;
      const s = m.badge / 2;
      parts.push(make("path", { class: "lk-mark lk-mark-correct", d: `M ${g.cx - s} ${cy} l ${s * 0.7} ${s * 0.8} l ${s * 1.3} ${-s * 1.5}`, fill: "none" }));
    }
    overlay.replaceChildren(...parts);
  }

  const say = (text) => {
    live.textContent = "";
    live.textContent = text;
  };
  const flash = (map, midi, ms) => {
    if (map.has(midi)) timers.clearTimeout(map.get(midi));
    map.set(
      midi,
      timers.setTimeout(() => {
        map.delete(midi);
        paint();
      }, ms),
    );
  };

  render();
  const offLang = i18n.onChange(render);
  const syncPressed = () => {
    pressed = new Set(bus.held());
    paint();
  };
  const offs = bus ? [bus.on("noteOn", syncPressed), bus.on("noteOff", syncPressed)] : [];
  root.addEventListener("scroll", updateHint);
  // The keyboard is redrawn and the page can shift under a finger (the card above it changes height), so
  // the release may land on something that is not a key: listen on the document too or the key would stay down.
  doc.addEventListener?.("pointerup", up);
  doc.addEventListener?.("pointercancel", up);

  return {
    element: root,
    /** Shows the keys from the white key `low` to the white key `high` (MIDI numbers). */
    setRegion(next) {
      region = { low: next.low, high: next.high };
      render();
    },
    setKeyContext(key) {
      keyContext = key ?? null;
      render();
    },
    setSpellings(list) {
      overrides = new Map(list.filter((k) => k.pitch).map((k) => [k.midi, k.pitch]));
      render();
    },
    /** Tells the keyboard how much room it has, in pixels, and redraws. */
    fit(next) {
      room = { width: next.width ?? room.width, height: next.height ?? room.height, portrait: next.portrait ?? room.portrait };
      render();
    },
    setStepKeys(keys) {
      stepKeys = keys.map((k) => ({ midi: k.midi, finger: k.finger, hand: k.hand ?? "R" }));
      paint();
      center();
    },
    /** True when the region is wider than the room and the keyboard scrolls sideways. */
    scrolls: () => overflowing,
    setPositionKeys(keys) {
      positionKeys = keys.map((k) => ({ midi: k.midi, finger: k.finger, hand: k.hand ?? "R" }));
      paint();
    },
    setLetters(map) {
      letters = new Map(map);
      paint();
    },
    setSounding(midis, hand = "R") {
      sounding = { midis: new Set(midis), hand };
      paint();
    },
    setHints(midis) {
      hints = new Set(midis);
      paint();
    },
    flashWrong(midi) {
      flash(wrong, midi, WRONG_MS);
      say(i18n.t("common.tryAgain"));
      paint();
    },
    flashCorrect(midis) {
      for (const midi of midis) flash(correct, midi, CORRECT_MS);
      say(i18n.t("common.correct"));
      paint();
    },
    /** Puts any text in the polite live region (Correct, Try again, the next instruction). */
    announce: say,
    region: () => ({ ...region }),
    metrics: () => ({ ...current.m, whiteCount: current.lay.whites.length }),
    dispose() {
      offLang();
      doc.removeEventListener?.("pointerup", up);
      doc.removeEventListener?.("pointercancel", up);
      for (const off of offs) off();
      for (const id of [...wrong.values(), ...correct.values()]) timers.clearTimeout(id);
      wrong.clear();
      correct.clear();
      root.remove();
      hint.remove();
    },
  };
}
