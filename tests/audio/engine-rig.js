// Test rig for the engine: a fake AudioContext, a recording synth and a manual timer.
import { createAudio } from "../../src/audio/context.js";
import { createEngine } from "../../src/audio/engine.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { validSong } from "../fixtures/helpers.js";
import { FakeAudioContext } from "./fake-audio.js";

export function rig({ timeline = resolveLevel(validSong(), "beginner"), latency = 0 } = {}) {
  const ctx = new FakeAudioContext();
  ctx.outputLatency = latency;
  const notes = [];
  const cancels = [];
  const makeSynth = () => ({
    playNote: (n) => notes.push(n),
    cancelPending: (now, opts) => cancels.push({ now, ...opts }),
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
  const engine = createEngine({ audio, timers, makeSynth });
  engine.setTimeline(timeline);
  /** Move the audio clock forward in 25 ms timer steps, like the real look-ahead loop. */
  const run = (seconds) => {
    const steps = Math.round(seconds / 0.025);
    for (let i = 0; i < steps; i += 1) {
      ctx.currentTime += 0.025;
      pending?.();
    }
  };
  return { ctx, engine, notes, cancels, run, hasTimer: () => pending !== null };
}
