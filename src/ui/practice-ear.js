// The page of an ear drill (hear the interval, hear the chord): play the question, answer with a button or by playing
// it back on the keyboard (taps, computer keys or MIDI), kind feedback, a count such as 7/10, and rounds of ten that
// unlock one more choice. It owns no rule: the ear reducer decides what every answer means and the screen model decides
// what to say. Playing the question uses generated notes only (engine.playNotes), so it never touches a song.
// The keyboard never shows the answer: nothing is shaded and nothing lights while a question sounds.
import { keyMapFor } from "../input/computer-keys.js";
import { initEar, reduceEar } from "../practice/ear.js";
import { earGrown, localIsoDate, readPracticeProgress, recordRun, summaryOf, withEarGrown, writePracticeProgress } from "../practice/progress.js";
import { earModel } from "./ear-screen.js";
import { cardModel, docArticle, summaryChips } from "./practice-doc.js";
import { el } from "./dom.js";
import { createLanguageSelect } from "./language-select.js";
import { createLearnKeyboard } from "./learn-keyboard.js";
import { createPracticeInputs } from "./practice-inputs.js";

// A learner answers by playing anywhere, so the keyboard is a fixed two octaves above middle C (C4 to B5).
const REGION = Object.freeze({ low: 60, high: 83 });

/**
 * createEarPage({ i18n, win, storage, exercise, makeEngine, seed }) -> { element, dispose() }, or null for an exercise
 * that is not an ear drill.
 */
export function createEarPage({ i18n, win, storage, exercise, makeEngine, seed = (Date.now() & 0xffff) + 1 }) {
  const t = i18n.t;
  const doc = win.document ?? globalThis.document;
  const kind = exercise.id === "ear-chords" ? "chord" : exercise.id === "ear-intervals" ? "interval" : null;
  if (!kind) return null;
  let progress = readPracticeProgress(storage);
  let state = initEar({ kind, seed, grown: earGrown(progress, exercise.id) });
  const inputs = createPracticeInputs({ i18n, win, storage, makeEngine });
  const { bus, engine, panel } = inputs;
  let disposed = false;

  // ---- elements ------------------------------------------------------------------------------------
  const top = el("div", { class: "learn-top practice-top" });
  const fold = el("details", { class: "practice-fold" });
  const progressLine = el("p", { class: "learn-progress meta" });
  const instruction = el("p", { class: "learn-instruction" });
  const sub = el("p", { class: "learn-sub meta" });
  const chip = el("span", { class: "learn-chip", hidden: true });
  const options = el("div", { class: "ear-options", role: "group" });
  const actions = el("div", { class: "learn-actions" });
  const card = el("section", { class: "learn-card practice-card ear-card" }, progressLine, instruction, sub, el("div", { class: "learn-feedback" }, chip), options, actions);
  const summary = el("section", { class: "practice-summary" });
  const keyboardMount = el("div", { class: "learn-keyboard-slot" });
  const langSelect = createLanguageSelect({ i18n });
  const view = el("section", { class: "practice practice-run practice-ear", "data-exercise": exercise.id }, top, fold, card, keyboardMount, panel.element, summary);
  const keyboard = createLearnKeyboard({ mount: keyboardMount, i18n, bus, doc });
  // No key: black keys take their sharp names, so the strip above the keys stays short and readable.
  keyboard.setKeyContext({ tonic: "C", mode: "major" });
  keyboard.setRegion(REGION);
  inputs.setKeyMap(keyMapFor(REGION, 60));

  const sizes = () => {
    const w = win.innerWidth ?? 1024;
    const h = win.innerHeight ?? 768;
    const slot = keyboardMount.clientWidth ?? 0;
    return { avail: Math.max(280, Math.min(slot > 0 ? slot : w - 32, 1168)), h, portrait: h > w };
  };
  function paintKeyboard() {
    const { avail, h, portrait } = sizes();
    const kbTop = keyboardMount.getBoundingClientRect?.().top ?? 0;
    keyboard.fit({ width: avail, height: Math.max(150, h - kbTop - ((panel.element.offsetHeight ?? 0) + 16)), portrait });
    keyboard.setLetters(new Map([...keyMapFor(REGION, 60)].map(([code, m]) => [m, inputs.legend().get(code) ?? ""])));
  }

  // ---- screen --------------------------------------------------------------------------------------
  function paintTop() {
    top.replaceChildren(el("a", { class: "button button-secondary learn-back", href: "#/practice" }, t("practice.back")), el("h2", { class: "learn-title practice-title" }, t(`ex.${exercise.id}.title`)), langSelect.element);
  }
  function paintFold() {
    fold.replaceChildren(el("summary", {}, t("practice.card.show")), docArticle(cardModel({ exercise, i18n })));
  }
  function paintCard() {
    const m = earModel(state, { i18n });
    view.setAttribute("data-phase", m.phase);
    card.setAttribute("data-phase", m.phase);
    progressLine.textContent = m.progress;
    instruction.textContent = m.heading;
    sub.textContent = m.sub;
    chip.hidden = !m.chip;
    chip.textContent = m.chip?.text ?? "";
    chip.setAttribute("data-kind", m.chip?.kind ?? "");
    options.hidden = m.options.length === 0;
    options.setAttribute("aria-label", t("ear.choices"));
    options.replaceChildren(
      ...m.options.map((o) => {
        const b = el("button", { type: "button", class: "btn ear-option", "data-option": o.id, "data-status": o.status, "aria-label": [o.label, o.tag].filter(Boolean).join(", ") }, el("span", { class: "ear-option-name" }, o.label), el("span", { class: "ear-option-hint" }, o.hint), o.tag ? el("span", { class: "ear-option-tag" }, o.tag) : null);
        b.addEventListener("click", () => dispatch({ type: "ANSWER", id: o.id }));
        return b;
      }),
    );
    actions.replaceChildren(
      ...m.actions.map((a) => {
        const b = el("button", { type: "button", class: `btn learn-action${a.primary ? " learn-primary" : ""}`, "data-action": a.id }, a.label);
        b.addEventListener("click", () => dispatch({ type: a.id }));
        return b;
      }),
    );
  }
  function paintSummary() {
    const chips = summaryChips(summaryOf(progress, exercise.id), t);
    summary.replaceChildren(el("h3", { class: "practice-summary-title" }, t(`ex.${exercise.id}.title`)), ...(chips.length > 0 ? [el("p", { class: "chips" }, chips.map((c) => el("span", { class: "chip" }, c)))] : []));
    summary.hidden = chips.length === 0;
  }
  function refresh() {
    paintCard();
    paintSummary();
    paintKeyboard();
  }

  // ---- effects -------------------------------------------------------------------------------------
  function runEffects(effects) {
    for (const e of effects) {
      if (e.type === "play") engine.playNotes?.(e.notes);
      else if (e.type === "releaseAll") bus.releaseAll();
      else if (e.type === "save") {
        progress = withEarGrown(progress, exercise.id, e.grown);
        writePracticeProgress(storage, progress);
      } else if (e.type === "record") {
        // A round is one run: clean when it earned a new choice (8 of 10 right). There is no tempo to record.
        progress = recordRun(progress, { exerciseId: exercise.id, key: "-", bpm: 0, clean: e.clean, date: localIsoDate() });
        writePracticeProgress(storage, progress);
      } else if (e.type === "announce") {
        keyboard.announce(e.kind === "correct" ? t("common.correct") : e.kind === "wrong" ? `${t("common.tryAgain")}. ${t("ear.tryHint")}` : "");
      }
    }
  }
  function dispatch(action) {
    if (disposed) return;
    const r = reduceEar(state, action);
    state = r.state;
    runEffects(r.effects);
    if (r.effects.length === 0 && (action.type === "NOTE_ON" || action.type === "NOTE_OFF")) return;
    refresh();
  }

  // ---- inputs: the same bus for taps, computer keys and MIDI -----------------------------------------
  const offs = [bus.on("noteOn", (e) => dispatch({ type: "NOTE_ON", midi: e.midi })), bus.on("noteOff", (e) => dispatch({ type: "NOTE_OFF", midi: e.midi }))];
  const offLang = i18n.onChange(() => {
    paintTop();
    paintFold();
    refresh();
  });
  const offLegend = inputs.onLegend(() => paintKeyboard());
  const onResize = () => paintKeyboard();
  win.addEventListener("resize", onResize);
  win.document?.body?.setAttribute("data-route", "practice-run");

  paintTop();
  paintFold();
  refresh();

  return {
    element: view,
    dispose() {
      disposed = true;
      for (const off of offs) off();
      offLang();
      offLegend();
      win.removeEventListener("resize", onResize);
      win.document?.body?.removeAttribute("data-route");
      bus.releaseAll();
      keyboard.dispose();
      langSelect.dispose();
      inputs.dispose();
    },
  };
}
