// The circle of fifths as a key picker: twelve buttons around a circle (C at the top, a fifth further for every step
// clockwise), the selected key filled, the keys already practiced ringed, and the keys suggested next dashed. No
// state relies on color alone: a ring, a dashed outline and the label the screen reader hears all say it. The
// positions come from CSS classes (`cof-pos-0` to `cof-pos-11`), because the page CSP does not allow inline styles.
import { TONICS } from "../theory/keys.js";
import { el } from "./dom.js";

/**
 * createCircleOfFifths({ i18n, onPick }) -> { element, set({ current, done, next }), dispose() }.
 * `onPick(tonic)` is called with the key the learner taps; with `readOnly` the circle only shows (the buttons are
 * disabled and keep their labels). `set` says which key is selected, which have a clean run
 * and which are suggested next; it redraws the labels, so the language can change at any time.
 */
export function createCircleOfFifths({ i18n, onPick = () => {}, readOnly = false }) {
  const root = el("div", { class: "cof", role: "group", ...(readOnly ? { "data-readonly": "true" } : {}) });
  const center = el("span", { class: "cof-center", "aria-hidden": "true" });
  const buttons = TONICS.map((tonic, i) => {
    const b = el("button", { type: "button", class: `btn cof-key cof-pos-${i}`, "data-key": tonic, ...(readOnly ? { disabled: true } : {}) }, tonic);
    b.addEventListener("click", () => onPick(tonic));
    return b;
  });
  root.append(...buttons, center);
  let current = "C";
  let done = new Set();
  let next = new Set();

  function render() {
    const t = i18n.t;
    root.setAttribute("aria-label", t("practice.cof.label"));
    center.textContent = t("key.major", { tonic: current });
    buttons.forEach((b, i) => {
      const tonic = TONICS[i];
      const states = [tonic === current ? t("practice.cof.current") : null, done.has(tonic) ? t("practice.cof.done") : null, next.has(tonic) && tonic !== current ? t("practice.cof.next") : null].filter(Boolean);
      b.setAttribute("aria-pressed", String(tonic === current));
      b.setAttribute("aria-label", [t("key.major", { tonic }), ...states].join(", "));
      b.setAttribute("title", [t("key.major", { tonic }), ...states].join(", "));
      b.setAttribute("data-done", String(done.has(tonic)));
      b.setAttribute("data-next", String(next.has(tonic) && tonic !== current));
    });
  }
  const off = i18n.onChange(render);
  render();

  return {
    element: root,
    set(state) {
      current = state.current ?? current;
      done = new Set(state.done ?? []);
      next = new Set(state.next ?? []);
      render();
    },
    dispose() {
      off();
      root.remove();
    },
  };
}
