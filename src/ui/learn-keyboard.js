// The 2D learn keyboard (SVG): a close, readable slice of the piano with a name on every key.
// Drawn in CSS pixels (the viewBox equals the size on screen), so a font size here is the size the
// learner reads. Geometry comes from core/keyboard-layout.js. Text goes through textContent only.
import { layoutRange } from "../core/keyboard-layout.js";
import { keyboardMetrics, namesFor, spellMidi } from "./keyboard-labels.js";

const NS = "http://www.w3.org/2000/svg";
const DEFAULT_REGION = Object.freeze({ low: 60, high: 74 }); // C4 to D5: nine white keys

/**
 * createLearnKeyboard({ mount, i18n, bus, doc }) -> { element, setRegion, setKeyContext, fit, region, dispose }.
 * `region` is { low, high }, the MIDI numbers of the first and last WHITE key shown. `fit({ width, height })`
 * tells the keyboard how much room it has (pixels); without it the width of `mount` is used.
 */
export function createLearnKeyboard({ mount, i18n, bus = null, doc = globalThis.document }) {
  let region = { ...DEFAULT_REGION };
  let keyContext = null;
  let room = { width: 0, height: Infinity };
  let overrides = new Map(); // midi -> spelled pitch the song gives (E# in F# major)

  const make = (tag, attrs = {}, text) => {
    const node = doc.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined && value !== null && value !== false) node.setAttribute(name, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const root = doc.createElement("div");
  root.setAttribute("class", "learn-keyboard");
  const svg = make("svg", { class: "lk-svg", role: "group", focusable: "false" });
  root.append(svg);
  mount.append(root);

  const keyEls = new Map(); // midi -> rect
  let current = null; // geometry of the last render

  function render() {
    const lay = layoutRange(region);
    const width = room.width > 0 ? room.width : (mount.clientWidth ?? 0) > 0 ? mount.clientWidth : 600;
    const m = keyboardMetrics({ whiteCount: lay.whites.length, width, height: room.height });
    const lang = i18n.lang();
    const total = lay.whites.length * m.keyW;
    const top = m.stripH;
    keyEls.clear();
    const strip = make("g", { class: "lk-strip" });
    const whites = make("g", { class: "lk-whites" });
    const blacks = make("g", { class: "lk-blacks" });
    const names = (midi) => namesFor({ midi, key: keyContext, pitch: overrides.get(midi) ?? null, lang });
    for (const k of lay.whites) {
      const n = names(k.midi);
      const x = Math.round(k.x * m.keyW);
      const cx = x + m.keyW / 2;
      const rect = make("rect", { class: "lk-key lk-white", "data-midi": k.midi, x, y: top, width: m.keyW, height: m.keyH, rx: 4 });
      keyEls.set(k.midi, rect);
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
      keyEls.set(k.midi, rect);
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
    svg.replaceChildren(strip, whites, blacks);
    current = { lay, m, top };
  }

  render();
  const offLang = i18n.onChange(render);

  return {
    element: root,
    /** Shows the keys from the white key `low` to the white key `high` (MIDI numbers). */
    setRegion(next) {
      region = { low: next.low, high: next.high };
      render();
    },
    /** The key of the song ({ tonic, mode }, or null) that decides how black keys are spelled. */
    setKeyContext(key) {
      keyContext = key ?? null;
      render();
    },
    /** Spellings the data gives for some keys, as [{ midi, pitch }]; they win over the key context. */
    setSpellings(list) {
      overrides = new Map(list.filter((k) => k.pitch).map((k) => [k.midi, k.pitch]));
      render();
    },
    /** Tells the keyboard how much room it has, in pixels, and redraws. */
    fit(next) {
      room = { width: next.width ?? room.width, height: next.height ?? room.height };
      render();
    },
    region: () => ({ ...region }),
    metrics: () => ({ ...current.m, whiteCount: current.lay.whites.length }),
    dispose() {
      offLang();
      root.remove();
    },
  };
}
