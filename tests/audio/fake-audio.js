// A recording stand-in for AudioContext, enough for synth, metronome and engine tests under node.
// Nothing here makes sound: it records oscillator start and stop times and parameter automation.

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.calls = [];
  }
  setValueAtTime(v, t) {
    this.calls.push(["set", v, t]);
    return this;
  }
  linearRampToValueAtTime(v, t) {
    this.calls.push(["linear", v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    this.calls.push(["exp", v, t]);
    return this;
  }
  setTargetAtTime(v, t, c) {
    this.calls.push(["target", v, t, c]);
    return this;
  }
  cancelScheduledValues(t) {
    this.calls.push(["cancel", t]);
    return this;
  }
}

class FakeNode {
  constructor(ctx, params = {}) {
    this.ctx = ctx;
    for (const [k, v] of Object.entries(params)) this[k] = new FakeParam(v);
    this.connections = [];
  }
  connect(to) {
    this.connections.push(to);
    return to;
  }
  disconnect() {
    this.connections = [];
  }
}

export class FakeOscillator extends FakeNode {
  constructor(ctx) {
    super(ctx, { frequency: 440, detune: 0 });
    this.type = "sine";
    this.startTime = null;
    this.stopTime = null;
  }
  start(t) {
    this.startTime = t;
  }
  stop(t) {
    // Like the real node, the first stop that is not later than an existing one wins for a future voice.
    this.stopTime = this.stopTime === null ? t : Math.min(this.stopTime, t);
  }
}

/** A buffer source: records its buffer, playback rate, start and stop like FakeOscillator. */
export class FakeBufferSource extends FakeNode {
  constructor(ctx) {
    super(ctx, { playbackRate: 1 });
    this.buffer = null;
    this.startTime = null;
    this.stopTime = null;
  }
  start(t) {
    this.startTime = t;
  }
  stop(t) {
    this.stopTime = this.stopTime === null ? t : Math.min(this.stopTime, t);
  }
}

export class FakeAudioContext {
  constructor(options = {}) {
    this.options = options;
    this.currentTime = 0;
    this.state = "suspended";
    this.outputLatency = 0;
    this.destination = new FakeNode(this);
    this.oscillators = [];
    this.bufferSources = [];
    this.decodeFails = () => false; // (byteLength) => true makes decodeAudioData reject for that file
    this.resumed = 0;
    this.suspended = 0;
  }
  resume() {
    this.state = "running";
    this.resumed += 1;
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    this.suspended += 1;
    return Promise.resolve();
  }
  createOscillator() {
    const o = new FakeOscillator(this);
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeBufferSource(this);
    this.bufferSources.push(s);
    return s;
  }
  decodeAudioData(arrayBuffer) {
    if (this.decodeFails(arrayBuffer.byteLength)) return Promise.reject(new Error("EncodingError"));
    return Promise.resolve({ decodedBytes: arrayBuffer.byteLength, duration: 4 });
  }
  createGain() {
    return new FakeNode(this, { gain: 1 });
  }
  createBiquadFilter() {
    const f = new FakeNode(this, { frequency: 350, Q: 1 });
    f.type = "lowpass";
    return f;
  }
  createDynamicsCompressor() {
    return new FakeNode(this, { threshold: -24, ratio: 12 });
  }
  /** Oscillators that sound at `t` (started, not yet stopped). */
  soundingAt(t) {
    return this.oscillators.filter((o) => o.startTime <= t && (o.stopTime === null || o.stopTime > t));
  }
}
