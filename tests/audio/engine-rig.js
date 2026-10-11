// Test rig for the engine: a fake AudioContext, recording synth and metronome, and a manual timer.
import { createAudio } from "../../src/audio/context.js";
import { createEngine } from "../../src/audio/engine.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { validSong } from "../fixtures/helpers.js";
import { FakeAudioContext } from "./fake-audio.js";

export function rig({ timeline = resolveLevel(validSong(), "beginner"), bpm, latency = 0, document } = {}) {
  const ctx = new FakeAudioContext();
  ctx.outputLatency = latency;
  const notes = [];
  const clicks = [];
  const cancels = [];
  const makeSynth = () => ({
    playNote: (n) => notes.push(n),
    cancelPending: (now, opts) => cancels.push({ now, ...opts }),
    dispose() {},
  });
  const makeMetronome = () => ({
    click: (when, o) => clicks.push({ when, ...o }),
    cancelPending() {},
    dispose() {},
  });
  let pending = null;
  const timers = {
    set: (fn) => {
      pending = fn;
      return 1;
    },
    clear: () => {
      pending = null;
    },
  };
  const audio = createAudio({ AudioContextCtor: function Ctor() { return ctx; } });
  const engine = createEngine({ audio, timers, makeSynth, makeMetronome, document });
  engine.setTimeline(timeline);
  if (bpm) engine.setBpm(bpm);
  /** Move the audio clock forward in 25 ms timer steps, like the real look-ahead loop. */
  const run = (seconds) => {
    const steps = Math.round(seconds / 0.025);
    for (let i = 0; i < steps; i += 1) {
      ctx.currentTime += 0.025;
      pending?.();
    }
  };
  return { ctx, engine, notes, clicks, cancels, run, fire: () => pending?.(), hasTimer: () => pending !== null };
}

/** A bare 12/8 timeline (dotted-quarter beats) with no notes, 2 bars long. */
export const compoundTimeline = () => ({
  meter: { num: 12, den: 8 },
  pickupTicks: 0,
  tempo: { bpm: 60, beatUnit: "dotted-quarter" },
  lengthTicks: 5760,
  notes: [],
  pedal: [],
});
