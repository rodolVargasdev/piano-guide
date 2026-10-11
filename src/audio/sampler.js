// Sampled piano: static audio samples (Salamander Grand Piano subset, one velocity layer, one sample every
// minor third) pitched between sample points by changing the playback rate. No library: fetch plus
// decodeAudioData. Same interface as synth.js (playNote, startHeld, releaseHeld, releaseAllHeld, cancelPending,
// activeCount, dispose) so voice.js can use either per note. Files load lazily (`load()` is called by the voice
// on first use, after a user gesture); a file that fails to load or decode is marked failed and never retried.

const ATTACK = 0.004;
const RELEASE = 0.18;
const PEDAL_RELEASE = 0.9;
const FAST_RELEASE = 0.04;
const LEVEL = 0.6;
export const MAX_VOICES = 48;
/** A sample is never pitched by more than this many semitones. */
export const MAX_DISTANCE = 3;

/** The point nearest to `midi` (the lower one on a tie), or null when there are none. Points are `{ midi }` objects. */
export function nearestSample(midi, points) {
  let best = null;
  for (const p of points) {
    if (best === null) best = p;
    else {
      const d = Math.abs(p.midi - midi);
      const bd = Math.abs(best.midi - midi);
      if (d < bd || (d === bd && p.midi < best.midi)) best = p;
    }
  }
  return best;
}

/** Playback rate that moves a sample recorded at `sampleMidi` to `midi`. */
export const playbackRate = (midi, sampleMidi) => 2 ** ((midi - sampleMidi) / 12);

function setRelease(param, now, seconds) {
  const level = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(level, now);
  param.setTargetAtTime(0, now, seconds / 4);
}

export function createSampler(ctx, { manifest, baseUrl, fetch = globalThis.fetch, maxVoices = MAX_VOICES } = {}) {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 4;
  master.connect(compressor);
  compressor.connect(ctx.destination);

  // One entry per sample point: { midi, file, buffer (when decoded), failed }.
  const points = (manifest?.samples ?? []).map((s) => ({ midi: s.midi, file: s.file, buffer: null, failed: false }));
  let loading = null;
  let voices = []; // { start, end, released, env, source, id?, learner? }
  let nextId = 0;

  const prune = (now) => {
    voices = voices.filter((v) => v.end > now);
  };

  function silence(v, now, seconds) {
    if (v.released) return;
    v.released = true;
    setRelease(v.env.gain, now, seconds);
    v.end = now + seconds + 0.05;
    v.source.stop(v.end);
  }

  function cancelFuture(v, now) {
    v.released = true;
    v.end = now;
    v.source.stop(now);
    v.env.disconnect();
  }

  function makeRoom(now) {
    prune(now);
    const live = voices.filter((v) => !v.released);
    for (let i = 0; live.length - i >= maxVoices; i += 1) silence(live[i], now, FAST_RELEASE);
  }

  /** The decoded point to use for `midi`, or null when none is decoded within MAX_DISTANCE semitones. */
  function pick(midi) {
    const best = nearestSample(midi, points.filter((p) => p.buffer));
    return best && Math.abs(best.midi - midi) <= MAX_DISTANCE ? best : null;
  }

  function buildVoice(midi, point, when, vel) {
    const source = ctx.createBufferSource();
    source.buffer = point.buffer;
    source.playbackRate.value = playbackRate(midi, point.midi);
    const env = ctx.createGain();
    source.connect(env);
    env.connect(master);
    const peak = LEVEL * Math.min(1, Math.max(0.05, vel));
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + ATTACK);
    source.start(when);
    return { env, source };
  }

  return {
    output: master,

    /** True when `midi` can be played from a decoded sample right now. */
    canPlay: (midi) => pick(midi) !== null,

    /** How many sample points are decoded, failed and total (for the voice and the tests). */
    status: () => ({ decoded: points.filter((p) => p.buffer).length, failed: points.filter((p) => p.failed).length, total: points.length }),

    /**
     * Fetches and decodes every sample once, the middle of the keyboard first. Resolves when all settled; a file
     * that fails is marked failed and the rest carry on. Safe to call again: it returns the same promise.
     */
    load() {
      if (loading) return loading;
      const order = [...points].sort((a, b) => Math.abs(a.midi - 60) - Math.abs(b.midi - 60));
      loading = Promise.all(
        order.map(async (p) => {
          try {
            const res = await fetch(new URL(p.file, baseUrl).href);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            p.buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          } catch {
            p.failed = true;
          }
        }),
      ).then(() => undefined);
      return loading;
    },

    /** Schedule a note like synth.playNote. Returns false when no decoded sample is near enough (the voice uses the synth). */
    playNote({ midi, vel = 0.7, when, dur, pedal = false }) {
      const point = pick(midi);
      if (!point) return false;
      makeRoom(ctx.currentTime);
      const release = pedal ? PEDAL_RELEASE : RELEASE;
      const end = Math.max(when + dur, when + ATTACK + 0.001);
      const { env, source } = buildVoice(midi, point, when, vel);
      env.gain.setTargetAtTime(0, end, release / 4);
      source.stop(end + release + 0.05);
      voices.push({ start: when, end: end + release + 0.05, released: false, env, source });
      return true;
    },

    /** Start a learner note that sounds until releaseHeld. Returns a voice id, or null when no sample is ready. */
    startHeld({ midi, vel = 0.7, when = ctx.currentTime }) {
      const point = pick(midi);
      if (!point) return null;
      makeRoom(ctx.currentTime);
      const { env, source } = buildVoice(midi, point, when, vel);
      nextId += 1;
      voices.push({ id: nextId, learner: true, start: when, end: Infinity, released: false, env, source });
      return nextId;
    },

    releaseHeld(voiceId, now = ctx.currentTime) {
      const v = voices.find((x) => x.id === voiceId);
      if (v) silence(v, now, RELEASE);
    },

    releaseAllHeld(now = ctx.currentTime) {
      for (const v of voices) if (v.learner) silence(v, now, RELEASE);
    },

    cancelPending(now = ctx.currentTime, { releaseSounding = true } = {}) {
      for (const v of voices) {
        if (v.learner) continue;
        if (v.start > now) cancelFuture(v, now);
        else if (releaseSounding) silence(v, now, FAST_RELEASE);
      }
      prune(now);
    },

    activeCount(now = ctx.currentTime) {
      prune(now);
      return voices.length;
    },

    dispose() {
      this.cancelPending(ctx.currentTime, { releaseSounding: true });
      this.releaseAllHeld(ctx.currentTime);
      master.disconnect();
      compressor.disconnect();
    },
  };
}
