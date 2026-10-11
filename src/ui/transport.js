// Transport controls: Play, Pause, Stop, seek bar with section marks, BPM field,
// Slow, Metronome and Count-in toggles, and the position readout.
// The pure helpers at the top are covered by node tests; createTransport only wires DOM to the engine.

import { el } from "./dom.js";
import { clampBpm, effectiveBpm, BPM_MIN, BPM_MAX } from "../core/practice.js";

/** Whole seconds as m:ss. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Bar 2, beat 3, 0:07"; the pickup (bar 0) reads "Pickup". */
export function formatReadout({ bar, beat, seconds }) {
  return `${bar === 0 ? "Pickup" : `Bar ${bar}`}, beat ${beat}, ${formatTime(seconds)}`;
}

/** BPM typed by the user, clamped to 20-240; empty or non-numeric text keeps `fallback`. */
export function parseBpmField(text, fallback) {
  const t = String(text ?? "").trim();
  if (t === "") return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? clampBpm(n) : fallback;
}

/** Seek-bar marks, one per section start, in section order. */
export function sectionMarks(sections) {
  return (sections ?? []).map((s) => ({ tick: s.startTick, label: s.name }));
}

/** The notice shown when both hands are muted, or an empty string. */
export function handsMessage(modes) {
  return modes?.L?.muted && modes?.R?.muted ? "Both hands muted" : "";
}

/** Text next to the BPM field while slow mode is on. */
export function slowNote(userBpm, slowMode) {
  return slowMode ? `Slow: ${Math.round(effectiveBpm({ userBpm, slowMode }) * 10) / 10} BPM` : "";
}

const button = (label, onClick) => {
  const b = el("button", { type: "button", class: "btn" }, label);
  b.addEventListener("click", onClick);
  return b;
};

/**
 * createTransport({ engine, timeline, onChange }) returns { element, update(pos), setHandModes(modes), dispose() }.
 * `onChange` runs after any control changes the engine so the player can draw a frame at once.
 */
export function createTransport({ engine, timeline, onChange = () => {} }) {
  let slow = false;
  let dragging = false;
  let lastReadout = "";

  const act = (fn) => () => {
    fn();
    onChange();
  };
  const play = button("Play", act(() => engine.play()));
  const pause = button("Pause", act(() => engine.pause()));
  const stop = button("Stop", act(() => engine.stop()));

  const marks = el("datalist", { id: "seek-marks" }, sectionMarks(timeline.sections).map((m) => el("option", { value: String(m.tick), label: m.label })));
  const seek = el("input", { type: "range", class: "seek", min: 0, max: timeline.lengthTicks, step: 1, value: 0, list: "seek-marks", "aria-label": "Position" });
  seek.addEventListener("pointerdown", () => (dragging = true));
  for (const type of ["pointerup", "pointercancel", "blur"]) seek.addEventListener(type, () => (dragging = false));
  seek.addEventListener("input", act(() => engine.seek(seek.valueAsNumber)));

  const bpm = el("input", { type: "number", class: "bpm", min: BPM_MIN, max: BPM_MAX, step: 1, value: engine.getBpm(), inputmode: "numeric" });
  const note = el("span", { class: "meta slow-note" });
  const refreshNote = () => (note.textContent = slowNote(engine.getBpm(), slow));
  bpm.addEventListener("change", act(() => {
    bpm.value = String(engine.setBpm(parseBpmField(bpm.value, engine.getBpm())));
    refreshNote();
  }));

  const toggle = (label, onChange2) => {
    const b = el("button", { type: "button", class: "btn toggle", "aria-pressed": "false" }, label);
    b.addEventListener("click", act(() => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      onChange2(on);
    }));
    return b;
  };
  const slowToggle = toggle("Slow", (on) => {
    slow = on;
    engine.setSlow(on);
    refreshNote();
  });
  const metronome = toggle("Metronome", (on) => engine.setMetronome({ enabled: on }));
  const countIn = toggle("Count-in", (on) => engine.setMetronome({ countIn: on }));

  const readout = el("output", { class: "readout" }, "Bar 1, beat 1, 0:00");
  const handsNote = el("p", { class: "hands-note", role: "status", hidden: true });

  const element = el(
    "section",
    { class: "transport", "aria-label": "Transport", "data-state": "stopped" },
    el("div", { class: "transport-row" }, play, pause, stop, readout),
    el("div", { class: "transport-row" }, seek, marks),
    el("div", { class: "transport-row" }, el("label", { class: "field" }, "BPM", bpm), note, slowToggle, metronome, countIn),
    handsNote,
  );

  const reflect = ({ state }) => {
    play.disabled = state === "playing";
    pause.disabled = state !== "playing";
    element.dataset.state = state;
    onChange();
  };
  reflect({ state: "stopped" });
  const off = engine.on("state", reflect);

  return {
    element,
    /** Draw the position: readout text and seek thumb (the thumb is left alone while the user drags it). */
    update(pos) {
      const text = formatReadout(pos);
      if (text !== lastReadout) {
        readout.textContent = text;
        lastReadout = text;
      }
      if (!dragging && seek.valueAsNumber !== Math.round(pos.tick)) seek.value = String(Math.round(pos.tick));
    },
    setHandModes(modes) {
      const text = handsMessage(modes);
      handsNote.textContent = text;
      handsNote.hidden = text === "";
    },
    dispose() {
      off();
      element.remove();
    },
  };
}
