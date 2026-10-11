// Practice controller: the state behind the practice panel (loop A-B, loop by section, tempo ramp,
// hands, range, quality). It owns no DOM and no audio; the effects it needs are injected, so the
// rules run under node. The math lives in core/practice.js; this module decides when to call it.

import { barBeatOf } from "../core/timing.js";
import { normalizeLoop, loopFromSection, canRamp, defaultRamp, normalizeRamp, nextRampBpm } from "../core/practice.js";
import { FULL_RANGE } from "../core/keyboard-layout.js";

export const QUALITY_CHOICES = Object.freeze(["auto", "high", "medium", "low", "minimum"]);

const bbLabel = ({ bar, beat }) => `${bar === 0 ? "pickup" : `bar ${bar}`}, beat ${beat}`;

/** "Bar 2, beat 1 to bar 3, beat 4" (the last beat is the last one inside the loop), or "Loop not set". */
export function formatLoop(loop, timeline) {
  if (!loop) return "Loop not set";
  const at = (t) => bbLabel(barBeatOf(t, timeline.meter, timeline.pickupTicks, timeline.tempo.beatUnit));
  const text = `${at(loop.startTick)} to ${at(loop.endTick - 1)}`;
  return text[0].toUpperCase() + text.slice(1);
}

const freshHands = () => ({ L: { muted: false, hidden: false }, R: { muted: false, hidden: false } });

/**
 * createPractice({ timeline, effects, position }) returns the controller.
 * effects: { setLoop(loop|null), setBpm(n), getBpm(), setHands(modes), setRange(range|null), setQuality(q) }.
 * `position()` gives the current song tick for "Set A here" and "Set B here".
 * state() is read-only; subscribe(fn) calls fn(state) after every change.
 */
export function createPractice({ timeline, effects, position = () => 0 }) {
  let tl = timeline;
  const s = {
    a: null, // raw A and B as the user set them
    b: null,
    snap: "bar",
    loop: null, // normalized range, or null ("Loop not set")
    loopOn: false,
    ramp: defaultRamp(timeline.tempo.bpm),
    rampOn: false,
    hold: false,
    hands: freshHands(),
    full: false,
    quality: "auto",
    message: "",
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(s));
  const active = () => (s.loopOn ? s.loop : null);

  function apply(range) {
    const loop = range === null ? null : normalizeLoop(range, { snap: s.snap, meter: tl.meter, pickupTicks: tl.pickupTicks, lengthTicks: tl.lengthTicks, tempo: tl.tempo });
    s.loop = loop;
    s.loopOn = loop !== null;
    s.message = loop || s.a === null || s.b === null ? "" : "Loop not set: choose two different points";
    if (!loop) s.rampOn = false;
    effects.setLoop(active());
  }
  const both = () => (s.a !== null && s.b !== null ? { startTick: s.a, endTick: s.b } : null);

  return {
    state: () => s,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    /** A level switch: same ticks, new meter and tempo data; the loop and flags stay. */
    setTimeline(next) {
      tl = next;
    },
    setA(tick = position()) {
      s.a = tick;
      apply(both());
      emit();
    },
    setB(tick = position()) {
      s.b = tick;
      apply(both());
      emit();
    },
    setSnap(snap) {
      s.snap = snap === "beat" ? "beat" : "bar";
      apply(both());
      emit();
    },
    /** Loop a named section; unknown ids change nothing. */
    loopSection(id) {
      const section = tl.sections.find((x) => x.id === id);
      if (!section) return;
      const range = loopFromSection(section);
      s.a = range.startTick;
      s.b = range.endTick;
      s.loop = range;
      s.loopOn = true;
      s.message = "";
      effects.setLoop(range);
      emit();
    },
    setLoopOn(on) {
      if (on && !s.loop) s.message = "Loop not set: choose A and B first";
      else {
        s.loopOn = on;
        s.message = "";
        if (!on) s.rampOn = false;
        effects.setLoop(active());
      }
      emit();
    },
    setRamp(patch) {
      s.ramp = normalizeRamp({ ...s.ramp, ...patch });
      emit();
    },
    setRampOn(on) {
      if (on && !canRamp(active())) s.message = "Needs a loop";
      else {
        s.rampOn = on;
        s.hold = false;
        s.message = "";
        if (on) effects.setBpm(s.ramp.start);
      }
      emit();
    },
    setHold(on) {
      s.hold = on && s.rampOn;
      emit();
    },
    /** Call on every completed loop pass: raises the BPM one step unless Hold is on. */
    onPass() {
      if (!s.rampOn || s.hold || !canRamp(active())) return;
      effects.setBpm(nextRampBpm({ current: effects.getBpm(), ...s.ramp }));
      emit();
    },
    /** Flip `muted` or `hidden` of one hand; the other flag and the other hand are untouched. */
    toggleHand(hand, flag) {
      s.hands = { ...s.hands, [hand]: { ...s.hands[hand], [flag]: !s.hands[hand][flag] } };
      effects.setHands(s.hands);
      emit();
    },
    setFull(on) {
      s.full = on;
      effects.setRange(on ? FULL_RANGE : null);
      emit();
    },
    setQuality(q) {
      s.quality = QUALITY_CHOICES.includes(q) ? q : "auto";
      effects.setQuality(s.quality);
      emit();
    },
  };
}
