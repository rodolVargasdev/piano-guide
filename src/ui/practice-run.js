// The page of one run exercise (a scale, chords, a progression...): the choices, the keys to press one step at a
// time on the learn keyboard with the finger shown, kind feedback, and what to do after a run. It owns no rule: the
// session reducer decides what every press means and the screen model decides what to say; this file wires them to
// the keyboard, the three inputs (taps, computer keys, MIDI), the audio engine and storage, and runs the effects.
// Hearing the exercise first plays generated notes only (engine.playNotes), so it never touches a song.
import { keyMapFor } from "../input/computer-keys.js";
import { learnRegion } from "../learn/region.js";
import { initSession, reduceSession } from "../practice/session.js";
import { localIsoDate, readPracticeProgress, recordRun, writePracticeProgress } from "../practice/progress.js";
import { announcement, choiceModel, screenModel } from "./practice-screen.js";
import { cardModel, docArticle } from "./practice-doc.js";
import { el } from "./dom.js";
import { createLanguageSelect } from "./language-select.js";
import { createLearnKeyboard } from "./learn-keyboard.js";
import { createPracticeInputs } from "./practice-inputs.js";

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const whiteBelow = (midi) => {
  let m = midi - 1;
  while (!WHITE.has(((m % 12) + 12) % 12)) m -= 1;
  return m;
};

/**
 * createExercisePage({ i18n, win, storage, exercise, makeEngine, seed }) -> { element, dispose() }, or null when the
 * exercise cannot be generated. `makeEngine` and `storage` are injectable so the page runs against fakes under node.
 */
export function createExercisePage({ i18n, win, storage, exercise, makeEngine, seed = (Date.now() & 0xffff) + 1 }) {
  const t = i18n.t;
  const doc = win.document ?? globalThis.document;
  let progress = readPracticeProgress(storage);
  let state = initSession({ exerciseId: exercise.id, progress, seed });
  if (!state) return null;
  const inputs = createPracticeInputs({ i18n, win, storage, makeEngine });
  const { bus, engine, panel } = inputs;
  let disposed = false;

  // ---- elements ------------------------------------------------------------------------------------
  const top = el("div", { class: "learn-top practice-top" });
  const options = el("div", { class: "practice-options" });
  const fold = el("details", { class: "practice-fold" });
  const progressLine = el("p", { class: "learn-progress meta" });
  const instruction = el("p", { class: "learn-instruction" });
  const sub = el("p", { class: "learn-sub meta" });
  const notice = el("p", { class: "practice-notice meta", role: "status" });
  const flag = el("p", { class: "practice-flag", hidden: true });
  const chip = el("span", { class: "learn-chip", hidden: true });
  const detail = el("span", { class: "learn-chip-detail meta" });
  const actions = el("div", { class: "learn-actions" });
  const card = el("section", { class: "learn-card practice-card" }, progressLine, instruction, sub, notice, flag, el("div", { class: "learn-feedback" }, chip, detail), actions);
  const keyboardMount = el("div", { class: "learn-keyboard-slot" });
  const langSelect = createLanguageSelect({ i18n });
  const view = el("section", { class: "practice practice-run", "data-exercise": exercise.id }, top, options, fold, card, keyboardMount, panel.element);
  const keyboard = createLearnKeyboard({ mount: keyboardMount, i18n, bus, doc });

  // ---- keyboard ------------------------------------------------------------------------------------
  let region = null;
  let contextSig = "";
  let anchor = null;
  const sizes = () => {
    const w = win.innerWidth ?? 1024;
    const h = win.innerHeight ?? 768;
    const slot = keyboardMount.clientWidth ?? 0;
    return { avail: Math.max(280, Math.min(slot > 0 ? slot : w - 32, 1168)), h, portrait: h > w };
  };
  const current = () => (state.phase === "running" ? state.run.steps[state.run.index] : state.phase === "ready" ? state.steps[0] : null);

  function paintKeyboard() {
    const all = state.steps.flatMap((s) => s.keys);
    const step = current();
    const stepKeys = step ? step.keys.map((k) => ({ midi: k.midi, finger: k.finger, hand: k.hand })) : [];
    const { avail, h, portrait } = sizes();
    // The whole exercise on the keyboard, so it does not move between steps: with a white key margin if the keys can
    // stay 36 px or more, without it if that is what fits, else the whole span and the keyboard scrolls to the step.
    const phraseMidis = all.map((k) => k.midi);
    const stepMidis = stepKeys.map((k) => k.midi);
    const maxWhite = Math.max(9, Math.floor(avail / ((win.innerWidth ?? 1024) >= 1000 ? 54 : 36)));
    let next = learnRegion({ phraseMidis, stepMidis, maxWhite, marginWhite: 1 });
    if (next.mode === "position") next = learnRegion({ phraseMidis, stepMidis, maxWhite, marginWhite: 0 });
    if (next.mode === "position") next = learnRegion({ phraseMidis, stepMidis, maxWhite: Infinity, marginWhite: 0 });
    const sig = `${state.exerciseId}|${state.options.key}|${state.options.hand}|${state.options.octaves}|${state.options.quality}|${state.options.direction}`;
    if (sig !== contextSig) {
      contextSig = sig;
      anchor = null;
      keyboard.setKeyContext({ tonic: state.options.key, mode: "major" });
      keyboard.setSpellings(all.map((k) => ({ midi: k.midi, pitch: k.pitch })));
    }
    const kbTop = keyboardMount.getBoundingClientRect?.().top ?? 0;
    keyboard.fit({ width: avail, height: Math.max(160, h - kbTop - ((panel.element.offsetHeight ?? 0) + 16)), portrait });
    if (!region || region.low !== next.low || region.high !== next.high) {
      region = { low: next.low, high: next.high };
      keyboard.setRegion(region);
    }
    keyboard.setStepKeys(stepKeys);
    keyboard.setPositionKeys([]);
    // The computer keys cover eleven white keys: the map moves only when the keys to press fall outside it.
    const wanted = stepKeys.map((k) => k.midi);
    let map = anchor === null ? null : keyMapFor(region, anchor);
    if (wanted.length > 0 && (map === null || !wanted.every((m) => [...map.values()].includes(m)))) {
      anchor = whiteBelow(Math.min(...wanted));
      map = keyMapFor(region, anchor);
    }
    map ??= keyMapFor(region, anchor ?? whiteBelow(region.low + 1));
    inputs.setKeyMap(map);
    keyboard.setLetters(new Map([...map].map(([code, m]) => [m, inputs.legend().get(code) ?? ""])));
  }

  // ---- screen --------------------------------------------------------------------------------------
  let feedback = null;
  let noticeText = "";
  let correctTimer = null;
  function paintTop() {
    top.replaceChildren(el("a", { class: "button button-secondary learn-back", href: "#/practice" }, t("practice.back")), el("h2", { class: "learn-title practice-title" }, t(`ex.${exercise.id}.title`)), langSelect.element);
  }
  function paintOptions() {
    options.replaceChildren(
      ...choiceModel(state, { i18n }).map((c) =>
        el(
          "div",
          { class: "seg practice-choice", role: "group", "aria-label": c.label, "data-choice": c.name },
          c.values.map((v) => {
            const b = el("button", { type: "button", class: "btn", "aria-pressed": String(v.value === c.current), "data-value": v.value }, v.label);
            b.addEventListener("click", () => dispatch({ type: "SET_OPTION", name: c.name, value: v.value }));
            return b;
          }),
        ),
      ),
    );
  }
  function paintCard() {
    const m = screenModel(state, { i18n, feedback });
    view.setAttribute("data-phase", state.phase);
    card.setAttribute("data-phase", state.phase);
    progressLine.textContent = [m.progress, m.tempo].filter(Boolean).join(" | ");
    instruction.textContent = m.heading;
    sub.textContent = m.sub;
    notice.textContent = state.phase === "running" || state.phase === "done" ? noticeText : "";
    notice.hidden = notice.textContent === "";
    flag.replaceChildren(...(m.suggested ? [el("span", { class: "chip chip-warn" }, t("practice.suggestedFingering")), el("span", {}, ` ${t("practice.suggestedHint")}`)] : []));
    flag.hidden = !m.suggested;
    chip.hidden = !m.chip;
    chip.textContent = m.chip?.text ?? "";
    chip.setAttribute("data-kind", m.chip?.kind ?? "");
    detail.textContent = m.chip?.detail ?? "";
    actions.replaceChildren(
      ...m.actions.map((a) => {
        const b = el("button", { type: "button", class: `btn learn-action${a.primary ? " learn-primary" : ""}`, "data-action": a.id }, a.label);
        b.addEventListener("click", () => dispatch({ type: a.id, held: [...bus.held()] }));
        return b;
      }),
    );
  }
  function paintFold() {
    const summary = el("summary", {}, t("practice.card.show"));
    fold.replaceChildren(summary, docArticle(cardModel({ exercise, i18n })));
  }
  function refresh() {
    paintOptions();
    paintCard();
    paintKeyboard();
  }

  // ---- effects -------------------------------------------------------------------------------------
  let timers = [];
  const stopHearing = () => {
    for (const id of timers) win.clearTimeout?.(id);
    timers = [];
    keyboard.setSounding([]);
    engine.stopNotes?.();
  };
  function hear(plan) {
    stopHearing();
    engine.playNotes?.(plan.notes);
    state.steps.forEach((step, i) => {
      timers.push(win.setTimeout?.(() => keyboard.setSounding(step.keys.map((k) => k.midi), step.keys[0]?.hand === "L" ? "L" : "R"), Math.round(i * plan.beat * 1000)));
    });
    timers.push(win.setTimeout?.(() => {
      keyboard.setSounding([]);
      if (!disposed) dispatch({ type: "LISTEN_DONE" });
    }, Math.round(plan.total * 1000) + 200));
  }
  function clearFeedbackSoon() {
    win.clearTimeout?.(correctTimer);
    correctTimer = win.setTimeout?.(() => {
      if (feedback?.kind === "correct") feedback = null;
      paintCard();
    }, 700);
  }
  function runEffects(effects) {
    for (const e of effects) {
      if (e.type === "listen") hear(e.plan);
      else if (e.type === "stopListen") stopHearing();
      else if (e.type === "releaseAll") bus.releaseAll();
      else if (e.type === "record") {
        progress = recordRun(progress, { exerciseId: e.exerciseId, key: e.key, bpm: e.bpm, clean: e.clean, date: localIsoDate() });
        writePracticeProgress(storage, progress);
      } else if (e.type === "announce") {
        if (e.kind === "correct") {
          keyboard.flashCorrect(e.keys);
          feedback = { kind: "correct" };
          clearFeedbackSoon();
        } else if (e.kind === "wrong" || e.kind === "octave") {
          keyboard.flashWrong(e.midi);
          feedback = { kind: e.kind };
          keyboard.announce(announcement(e, { i18n }));
        } else if (e.kind === "start") {
          feedback = null;
          noticeText = "";
        } else if (e.kind === "nextKey" || e.kind === "stage") {
          noticeText = announcement(e, { i18n });
          keyboard.announce(noticeText);
        } else if (e.kind === "done") {
          keyboard.announce(announcement(e, { i18n }));
        }
      }
    }
  }
  function dispatch(action) {
    if (disposed) return;
    const r = reduceSession(state, action);
    state = r.state;
    runEffects(r.effects);
    // A press that changed nothing on screen (a release, an ignored key) is not worth redrawing the keyboard for.
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
      stopHearing();
      win.clearTimeout?.(correctTimer);
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
