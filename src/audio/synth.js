// Piano-like voices from core Web Audio nodes only (no samples).
// Voice: triangle + sine partial (+3 cents) + octave sine (-12 dB) -> lowpass (velocity-scaled
// cutoff that closes as the note decays) -> gain envelope -> shared compressor.
// Every voice is tracked so seek and pause can cancel it without stuck or doubled notes.
// Learner voices (startHeld / releaseHeld) sound until released, share the voice cap, and are the one
// kind of voice cancelPending leaves alone, so stopping a song never cuts a key the learner holds.

const ATTACK = 0.004;
const RELEASE = 0.18;
const PEDAL_RELEASE = 0.9;
const OCTAVE_GAIN = Math.pow(10, -12 / 20);
const SUSTAIN_FLOOR = 0.18;
const FAST_RELEASE = 0.04;
export const MAX_VOICES = 48;

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// Low notes ring longer than high ones: about 3.2 s at A0 down to 0.8 s at C8.
const decayTime = (midi) => 3.2 - (2.4 * (Math.min(108, Math.max(21, midi)) - 21)) / 87;

function setRelease(param, now, seconds) {
  const level = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(level, now);
  param.setTargetAtTime(0, now, seconds / 4);
}

export function createSynth(ctx, { maxVoices = MAX_VOICES } = {}) {
  const master = ctx.createGain();
  master.gain.value = 0.7;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 4;
  master.connect(compressor);
  compressor.connect(ctx.destination);

  let voices = []; // { start, end, released, env, oscs, filter, id?, learner? }
  let nextId = 0;

  const prune = (now) => {
    voices = voices.filter((v) => v.end > now);
  };

  function silence(v, now, seconds) {
    if (v.released) return;
    v.released = true;
    setRelease(v.env.gain, now, seconds);
    v.end = now + seconds + 0.05;
    v.oscs.forEach((o) => o.stop(v.end));
  }

  function cancelFuture(v, now) {
    v.released = true;
    v.end = now;
    v.oscs.forEach((o) => o.stop(now));
    v.env.disconnect();
  }

  // Oscillators -> lowpass -> gain envelope -> master, started at `when`; the caller automates and stops them.
  function buildVoice(midi, when, oscStop) {
    const freq = hz(midi);
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.connect(env);
    env.connect(master);
    const oscs = [
      { type: "triangle", f: freq, detune: 0, level: 1 },
      { type: "sine", f: freq, detune: 3, level: 0.5 },
      { type: "sine", f: freq * 2, detune: 0, level: OCTAVE_GAIN },
    ].map((p) => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = p.f;
      osc.detune.value = p.detune;
      const g = ctx.createGain();
      g.gain.value = p.level;
      osc.connect(g);
      g.connect(filter);
      osc.start(when);
      if (oscStop !== undefined) osc.stop(oscStop);
      return osc;
    });
    return { env, filter, oscs };
  }

  // Past `maxVoices`, the oldest sounding voices (learner voices included) are released first.
  function makeRoom(now) {
    prune(now);
    const live = voices.filter((v) => !v.released);
    for (let i = 0; live.length - i >= maxVoices; i += 1) silence(live[i], now, FAST_RELEASE);
  }

  return {
    /** Output node, in case another module wants to join the compressed bus. */
    output: master,

    /**
     * Schedule a note: starts at audio time `when`, held for `dur` seconds, then released
     * (a longer release while `pedal` is true). Past `maxVoices`, the oldest voices are released first.
     */
    playNote({ midi, vel = 0.7, when, dur, pedal = false }) {
      makeRoom(ctx.currentTime);
      const peak = 0.32 * Math.min(1, Math.max(0.05, vel));
      const decay = decayTime(midi);
      const release = pedal ? PEDAL_RELEASE : RELEASE;
      const end = Math.max(when + dur, when + ATTACK + 0.001);
      // The decay ramp stops at note-off so the release never overlaps it in the automation timeline.
      const rampEnd = Math.min(end, when + ATTACK + decay);
      const level = peak * Math.pow(SUSTAIN_FLOOR, (rampEnd - when - ATTACK) / decay);

      const { env, filter, oscs } = buildVoice(midi, when, end + release + 0.05);
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(peak, when + ATTACK);
      env.gain.exponentialRampToValueAtTime(level, rampEnd);
      env.gain.setTargetAtTime(0, end, release / 4);
      filter.frequency.setValueAtTime(1500 + 4500 * vel, when);
      filter.frequency.exponentialRampToValueAtTime(900, rampEnd);
      voices.push({ start: when, end: end + release + 0.05, released: false, env, oscs, filter });
    },

    /**
     * Start a learner note that sounds until `releaseHeld` (no scheduled end): the attack, then the same
     * decay down to the sustain floor. Returns a voice id. It counts toward the voice cap and survives
     * cancelPending. `when` defaults to the audio clock (no look-ahead delay).
     */
    startHeld({ midi, vel = 0.7, when = ctx.currentTime }) {
      makeRoom(ctx.currentTime);
      const peak = 0.32 * Math.min(1, Math.max(0.05, vel));
      const decay = decayTime(midi);
      const { env, filter, oscs } = buildVoice(midi, when);
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(peak, when + ATTACK);
      env.gain.exponentialRampToValueAtTime(peak * SUSTAIN_FLOOR, when + ATTACK + decay);
      filter.frequency.setValueAtTime(1500 + 4500 * vel, when);
      filter.frequency.exponentialRampToValueAtTime(900, when + ATTACK + decay);
      nextId += 1;
      voices.push({ id: nextId, learner: true, start: when, end: Infinity, released: false, env, oscs, filter });
      return nextId;
    },

    /** Releases a learner voice with the release envelope (no click). An unknown or already released id is ignored. */
    releaseHeld(voiceId, now = ctx.currentTime) {
      const v = voices.find((x) => x.id === voiceId);
      if (v) silence(v, now, RELEASE);
    },

    /** Releases every learner voice (blur, route change, MIDI disconnect). */
    releaseAllHeld(now = ctx.currentTime) {
      for (const v of voices) if (v.learner) silence(v, now, RELEASE);
    },

    /**
     * Cancel voices that have not started yet; with `releaseSounding` also fade out the ones
     * already sounding (pause, stop, seek). Without it sounding voices play on (tempo change).
     */
    cancelPending(now = ctx.currentTime, { releaseSounding = true } = {}) {
      for (const v of voices) {
        if (v.learner) continue; // a key the learner holds is not part of the song
        if (v.start > now) cancelFuture(v, now);
        else if (releaseSounding) silence(v, now, FAST_RELEASE);
      }
      prune(now);
    },

    /** Voices that exist and have not ended at `now`. */
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
