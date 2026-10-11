// Learn view: the teacher. It owns no rule: the lesson reducer decides what every press means, the screen
// model decides what to say, and this file wires them to the keyboard, the three inputs, the audio engine
// and storage, and runs the effects the reducer returns. dispose() releases every note and every listener.
import { activeAt, resolveLevel } from "../core/timeline.js";
import { textOf } from "../core/text.js";
import { createAudio } from "../audio/context.js";
import { createEngine } from "../audio/engine.js";
import { HOME_ROW, UPPER_ROW, attachComputerKeys, keyMapFor, legendFor } from "../input/computer-keys.js";
import { createNoteBus } from "../input/bus.js";
import { createLearnerSound } from "../input/learner-sound.js";
import { createMidiInput } from "../input/midi.js";
import { handHasNotes, initLesson, reduce } from "../learn/lesson.js";
import { positionKeys } from "../learn/position.js";
import { clearSong, positionOf, readProgress, withPosition, withTranspose, writeProgress } from "../learn/progress.js";
import { learnRegion } from "../learn/region.js";
import { canLearn, loadCatalog } from "./catalog.js";
import { el } from "./dom.js";
import { createInputPanel } from "./input-panel.js";
import { createLearnKeyboard } from "./learn-keyboard.js";
import { screenModel } from "./learn-screen.js";
import { createLanguageSelect } from "./language-select.js";

let sharedAudio = null;
const defaultMakeEngine = () => createEngine({ audio: (sharedAudio ??= createAudio()) });
const safeStorage = (win) => {
  try {
    return win.localStorage;
  } catch {
    return undefined; // blocked storage: the lesson works for the session only
  }
};
const isPlayable = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const whiteBelow = (midi) => {
  let m = midi - 1;
  while (!WHITE.has(((m % 12) + 12) % 12)) m -= 1;
  return m;
};

/** Levels of the song that have at least one pitched note: the only ones the learner can choose. */
export function learnableLevels(song) {
  return Object.keys(song.levels ?? {}).filter((id) => resolveLevel(song, id).notes.some(isPlayable));
}

/**
 * learnView({ i18n, load, makeEngine, win, storage }) returns a router view (route, root) => { dispose() }.
 * Dependencies are injectable so the view runs against fakes under node.
 */
export function learnView({ i18n, load = loadCatalog, makeEngine = defaultMakeEngine, win = window, storage = safeStorage(win) } = {}) {
  const t = i18n.t;
  return (route, root) => {
    let disposed = false;
    let session = null;
    const message = (title, detail) => root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, title), detail ? el("p", { class: "meta" }, detail) : null, el("a", { class: "button", href: "#/" }, t("common.catalog"))));
    root.replaceChildren(el("p", { class: "meta", role: "status" }, t("common.loading")));
    load().then(({ error, entries }) => {
      if (disposed) return;
      const found = entries.find((e) => e.entry.id === route.songId);
      if (error) return message(t("catalog.loadError"), error.reason);
      if (!found) return message(t("common.songNotFound"));
      if (found.status !== "ok") return message(t("catalog.unavailable"), found.reasonKey ? t(found.reasonKey) : found.reason);
      if (!canLearn(found.song)) return message(t("catalog.noNotes"));
      session = mount(found.song);
    });

    function mount(song) {
      const doc = win.document ?? globalThis.document;
      let progress = readProgress(storage);
      const levels = learnableLevels(song);
      let levelId = levels.includes(route.level) ? route.level : levels.includes(song.defaultLevel) ? song.defaultLevel : levels[0];
      const bus = createNoteBus();
      const engine = makeEngine();
      let panel = null;
      // The learner's own sound is the FIRST subscriber, so a press is never delayed by anything else.
      const sound = createLearnerSound({ bus, engine, settings: { midiSound: () => panel?.midiSound() === true } });

      // ---- lesson state ------------------------------------------------------------------------
      let state = null;
      const startLesson = (opts = {}) => {
        const allowed = (tonic) => tonic === song.key.tonic || resolveLevel(song, levelId).learn?.transposeTo?.includes(tonic);
        const saved = progress.transpose[song.id];
        const wanted = opts.keyTonic ?? (saved && allowed(saved) ? saved : song.key.tonic);
        try {
          state = initLesson({ song, levelId, keyTonic: wanted, progress, ...(opts.hand ? { hand: opts.hand } : {}) });
        } catch {
          state = initLesson({ song, levelId, keyTonic: song.key.tonic, progress }); // no valid transposition: the original key
        }
      };
      startLesson();
      // The author's learn block of the ORIGINAL song: a transposed copy does not carry it, and the toggle must stay.
      const learnBlock = () => resolveLevel(song, levelId).learn ?? {};

      // ---- elements ----------------------------------------------------------------------------
      const top = el("div", { class: "learn-top" });
      const progressLine = el("p", { class: "learn-progress meta" });
      const instruction = el("p", { class: "learn-instruction" });
      const sub = el("p", { class: "learn-sub meta" });
      const chip = el("span", { class: "learn-chip", hidden: true });
      const detail = el("span", { class: "learn-chip-detail meta" });
      const actions = el("div", { class: "learn-actions" });
      const card = el("section", { class: "learn-card" }, progressLine, instruction, sub, el("div", { class: "learn-feedback" }, chip, detail), actions);
      const keyboardMount = el("div", { class: "learn-keyboard-slot" });
      const langSelect = createLanguageSelect({ i18n });
      const midi = createMidiInput({ navigator: win.navigator, isSecureContext: win.isSecureContext, bus, onState: (st) => panel?.setMidiState(st) });
      panel = createInputPanel({ i18n, storage, connect: () => midi.connect(), midi: { state: midi.state(), names: [] } });
      const view = el("section", { class: "learn" }, top, card, keyboardMount, panel.element);
      root.replaceChildren(view);
      win.document?.body?.setAttribute("data-route", "learn");

      const keyboard = createLearnKeyboard({ mount: keyboardMount, i18n, bus, doc });

      // ---- keyboard region, shading and computer keys ---------------------------------------------
      let region = null;
      let contextSig = "";
      let keyMap = new Map();
      let legend = new Map();
      const sizes = () => {
        const w = win.innerWidth ?? 1024;
        const h = win.innerHeight ?? 768;
        const landscape = h <= 480 && w > h;
        const avail = Math.max(280, Math.min(w - 32, 1168));
        const minPx = w >= 1000 ? 72 : landscape ? 54 : 36;
        return { avail, maxWhite: Math.min(15, Math.floor(avail / minPx)), h };
      };

      function paintKeyboard() {
        const s = state;
        const step = s.phase === "yourTurn" ? s.steps[s.stepIndex] : null;
        const first = step ?? s.steps[0];
        const pos = first && s.phase !== "start" ? positionKeys(first.position, s.hand) : [];
        const phraseMidis = s.steps.flatMap((st) => st.keys.map((k) => k.midi));
        const stepKeys = step ? step.keys.map((k) => ({ midi: k.midi, finger: k.finger, hand: k.hand ?? s.hand })) : [];
        const { avail, maxWhite, h } = sizes();
        const next = learnRegion({ phraseMidis, positionMidis: pos.map((k) => k.midi), stepMidis: stepKeys.map((k) => k.midi), maxWhite });
        const sig = `${s.timeline.key.tonic}|${s.phraseIndex}|${s.hand}`;
        if (sig !== contextSig) {
          contextSig = sig;
          keyboard.setKeyContext(s.timeline.key);
          keyboard.setSpellings(phraseMidis.length ? s.steps.flatMap((st) => st.keys.map((k) => ({ midi: k.midi, pitch: k.pitch }))) : []);
        }
        const kbTop = keyboardMount.getBoundingClientRect?.().top ?? 0;
        const below = (panel.element.offsetHeight ?? 0) + 16;
        keyboard.fit({ width: avail, height: Math.max(140, h - kbTop - below) });
        if (!region || region.low !== next.low || region.high !== next.high) {
          region = { low: next.low, high: next.high };
          keyboard.setRegion(region);
        }
        keyboard.setStepKeys(stepKeys);
        keyboard.setPositionKeys(pos.filter((k) => !stepKeys.some((x) => x.midi === k.midi)));
        keyMap = keyMapFor(region, whiteBelow(pos[0]?.midi ?? region.low));
        keyboard.setLetters(new Map([...keyMap].map(([code, m]) => [m, legend.get(code) ?? ""])));
        panel.setComputerKeys(true);
      }

      // ---- screen ------------------------------------------------------------------------------
      let correctTimer = null;
      let correctHidden = false;
      function paintCard() {
        const model = screenModel(state, { i18n, hasSaved: Boolean(positionOf(progress, song.id, levelId, state.keyTonic)), showProgressReset: Boolean(progress.songs[song.id]) });
        progressLine.textContent = model.progress;
        instruction.textContent = model.heading;
        sub.textContent = model.sub;
        const showChip = model.chip && !(model.chip.kind === "correct" && correctHidden);
        chip.hidden = !showChip;
        chip.textContent = showChip ? model.chip.text : "";
        chip.setAttribute("data-kind", model.chip?.kind ?? "");
        detail.textContent = showChip ? model.chip.detail : "";
        card.setAttribute("data-phase", state.phase);
        const buttons = model.actions.map((a) => {
          const b = el("button", { type: "button", class: `btn learn-action${a.primary ? " learn-primary" : ""}`, "data-action": a.id }, a.label);
          b.addEventListener("click", () => act(a.id));
          return b;
        });
        if (model.phase === "start" && model.showProgressReset) {
          const reset = el("button", { type: "button", class: "btn learn-action learn-reset", "data-action": "RESET" }, t("common.resetProgress"));
          reset.addEventListener("click", () => act("RESET"));
          buttons.push(reset);
        }
        if (model.phase === "songComplete") buttons.push(el("a", { class: "button button-secondary", href: `#/song/${song.id}` }, t(state.silent ? "common.playAlongNoSound" : "common.playAlong")), el("a", { class: "button button-secondary", href: "#/" }, t("common.catalog")));
        actions.replaceChildren(...buttons);
      }

      const segment = (label, pressed, onClick, extra = {}) => {
        const b = el("button", { type: "button", class: "btn", "aria-pressed": String(pressed), ...extra }, label);
        b.addEventListener("click", onClick);
        return b;
      };
      function paintTop() {
        const parts = [el("a", { class: "button button-secondary learn-back", href: "#/" }, t("common.catalog")), el("h2", { class: "learn-title" }, song.title)];
        const hands = ["R", "L"].filter((h) => handHasNotes(state.timeline, h));
        if (hands.length > 1) parts.push(el("div", { class: "seg learn-hands", role: "group", "aria-label": t("learn.hand") }, hands.map((h) => segment(t(`hand.${h}`), state.hand === h, () => dispatch({ type: "SET_HAND", hand: h })))));
        const tonics = [song.key.tonic, ...(learnBlock().transposeTo ?? [])];
        if (tonics.length > 1) parts.push(el("div", { class: "seg learn-keys", role: "group", "aria-label": t("learn.key") }, tonics.map((tonic) => segment(t("key.major", { tonic }), state.keyTonic === tonic, () => dispatch({ type: "SET_KEY", tonic })))));
        if (levels.length > 1) parts.push(el("div", { class: "seg learn-levels", role: "group", "aria-label": t("learn.level") }, levels.map((id) => segment(textOf(song.levels[id].label, i18n.lang()), levelId === id, () => switchLevel(id)))));
        parts.push(langSelect.element);
        top.replaceChildren(...parts);
      }

      function refresh() {
        paintTop();
        paintCard();
        paintKeyboard();
      }

      // ---- actions and effects ---------------------------------------------------------------------
      let listenToken = 0;
      let raf = null;
      const stopFrames = () => {
        if (raf !== null) win.cancelAnimationFrame?.(raf);
        raf = null;
        keyboard.setSounding([]);
      };
      function frames(token) {
        raf = win.requestAnimationFrame?.(() => {
          raf = null;
          if (token !== listenToken || state.phase !== "listening") return keyboard.setSounding([]);
          const pos = engine.position?.();
          if (pos) keyboard.setSounding(activeAt(state.timeline, pos.tick).filter((n) => n.hand === state.hand && isPlayable(n)).map((n) => n.midi), state.hand);
          frames(token);
        }) ?? null;
      }
      function listen(e) {
        const token = ++listenToken;
        engine.setTimeline(state.timeline);
        Promise.resolve(engine.playRange({ startTick: e.startTick, endTick: e.endTick, hand: e.hand })).then(
          ({ status } = {}) => {
            if (!disposed && token === listenToken && status !== "cancelled") act("LISTEN_DONE");
          },
          () => {
            if (!disposed && token === listenToken) act("LISTEN_DONE");
          },
        );
        frames(token);
      }
      const today = () => new Date().toISOString().slice(0, 10);
      function save(e) {
        progress = withPosition(progress, { ...e.position, date: today() });
        if ("transpose" in e) progress = withTranspose(progress, e.position.songId, e.transpose);
        writeProgress(storage, progress);
      }
      function announce(e, prev) {
        if (e.kind === "wrong" || e.kind === "octave") {
          keyboard.flashWrong(e.midi);
          keyboard.announce(`${t("common.tryAgain")}. ${t(e.kind === "octave" ? "learn.octave" : "learn.useShaded")}`);
          return;
        }
        const keys = (prev.steps[prev.stepIndex]?.keys ?? []).map((k) => k.midi);
        keyboard.flashCorrect(keys);
        const heading = screenModel(state, { i18n }).heading;
        keyboard.announce(e.kind === "correct" ? `${t("common.correct")}. ${heading}` : heading);
        correctHidden = false;
        win.clearTimeout?.(correctTimer);
        correctTimer = win.setTimeout?.(() => {
          correctHidden = true;
          paintCard();
        }, 700);
      }
      function run(effects, prev) {
        for (const e of effects) {
          if (e.type === "listen") listen(e);
          else if (e.type === "stopListen") {
            listenToken += 1;
            stopFrames();
            engine.stopRange?.();
          } else if (e.type === "save") save(e);
          else if (e.type === "announce") announce(e, prev);
          else if (e.type === "releaseAll") bus.releaseAll();
        }
      }
      function dispatch(action) {
        if (disposed) return;
        const prev = state;
        const r = reduce(state, action);
        state = r.state;
        if (state.phase !== "listening") stopFrames();
        run(r.effects, prev);
        refresh();
      }
      function switchLevel(id) {
        if (id === levelId) return;
        levelId = id;
        stopFrames();
        startLesson();
        refresh();
      }
      function act(id) {
        if (id === "RESET") {
          clearSong(storage, song.id);
          progress = readProgress(storage);
          startLesson({ keyTonic: song.key.tonic });
          return refresh();
        }
        dispatch({ type: id });
      }

      // ---- inputs: the same bus for screen, computer keys and MIDI ---------------------------------
      const offs = [
        bus.on("noteOn", (e) => dispatch({ type: "NOTE_ON", midi: e.midi })),
        bus.on("noteOff", (e) => dispatch({ type: "NOTE_OFF", midi: e.midi })),
      ];
      const detachKeys = attachComputerKeys({ target: win, bus, getMap: () => keyMap, doc: win.document });
      const offLang = i18n.onChange(() => {
        dispatch({ type: "SET_LANG", lang: i18n.lang() });
      });
      const onResize = () => paintKeyboard();
      win.addEventListener("resize", onResize);
      legendFor([...HOME_ROW, ...UPPER_ROW], win.navigator).then((map) => {
        if (disposed) return;
        legend = map;
        paintKeyboard();
      });

      // Leaving: stop Listen and let go of every held note, as the reducer's LEAVE effects say.
      function leave() {
        const r = reduce(state, { type: "LEAVE" });
        listenToken += 1;
        for (const e of r.effects) {
          if (e.type === "stopListen") engine.stopRange?.();
          if (e.type === "releaseAll") bus.releaseAll();
        }
      }

      refresh();

      return {
        dispose() {
          disposed = true;
          leave();
          for (const off of offs) off();
          detachKeys();
          win.removeEventListener("resize", onResize);
          offLang();
          win.clearTimeout?.(correctTimer);
          stopFrames();
          win.document?.body?.removeAttribute("data-route");
          midi.dispose();
          sound.dispose();
          panel.dispose();
          keyboard.dispose();
          langSelect.dispose();
          bus.dispose();
          engine.dispose?.();
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
