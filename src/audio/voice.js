// The one voice the engine plays through: per note, the sampled piano when a decoded sample is near enough,
// otherwise the oscillator synthesizer. Samples load lazily when the voice is created (the engine creates it
// inside the first user gesture); until then, and whenever the manifest or a file is missing or does not decode,
// every note falls back to the synthesizer silently (no error is shown, nothing is thrown). The interface is the
// synth's, so the engine does not know which one sounds.

import { createSynth, MAX_VOICES } from "./synth.js";
import { createSampler } from "./sampler.js";

const DEFAULT_BASE_URL = new URL("../../assets/audio/piano/", import.meta.url).href;

export function createVoice(ctx, { baseUrl = DEFAULT_BASE_URL, fetch = globalThis.fetch, maxVoices = MAX_VOICES, makeSynth = createSynth, makeSampler = createSampler } = {}) {
  const synth = makeSynth(ctx, { maxVoices });
  let sampler = null;
  let loadDone = Promise.resolve();
  const held = new Map(); // voice id -> { source: "sampler" | "synth", id }
  let nextId = 0;

  // The manifest is fetched first, then the samples. Any failure leaves the synthesizer as the only voice.
  if (typeof ctx.decodeAudioData === "function" && typeof fetch === "function") {
    loadDone = (async () => {
      try {
        const res = await fetch(new URL("manifest.json", baseUrl).href);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const manifest = await res.json();
        // Usable at once: each sample counts as soon as it is decoded, the middle of the keyboard first.
        sampler = makeSampler(ctx, { manifest, baseUrl, fetch, maxVoices });
        await sampler.load();
      } catch {
        sampler = null;
      }
    })();
  }

  return {
    output: synth.output,

    /** Resolves when the loading attempt has finished, whatever its outcome (for tests and the browser check). */
    ready: () => loadDone,

    /** "sampler" when the next note at `midi` would use a decoded sample, otherwise "synth". */
    sourceFor: (midi) => (sampler?.canPlay(midi) ? "sampler" : "synth"),

    playNote(note) {
      if (sampler?.playNote(note)) return;
      synth.playNote(note);
    },

    startHeld(opts) {
      const fromSampler = sampler?.startHeld(opts) ?? null;
      nextId += 1;
      held.set(nextId, fromSampler === null ? { source: "synth", id: synth.startHeld(opts) } : { source: "sampler", id: fromSampler });
      return nextId;
    },

    releaseHeld(voiceId, now) {
      const h = held.get(voiceId);
      if (!h) return;
      (h.source === "sampler" ? sampler : synth)?.releaseHeld(h.id, now);
      held.delete(voiceId);
    },

    releaseAllHeld(now) {
      synth.releaseAllHeld(now);
      sampler?.releaseAllHeld(now);
      held.clear();
    },

    cancelPending(now, opts) {
      synth.cancelPending(now, opts);
      sampler?.cancelPending(now, opts);
    },

    activeCount: (now) => synth.activeCount(now) + (sampler?.activeCount(now) ?? 0),

    dispose() {
      synth.dispose();
      sampler?.dispose();
      held.clear();
    },
  };
}
