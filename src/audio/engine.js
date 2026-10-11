// Playback engine: the single owner of musical time. The Web Audio clock is the only clock;
// views read engine.position() once per frame and never keep time of their own.
//
// A 25 ms timer schedules every note that falls inside a short look-ahead window, using the
// pure helpers in core/schedule and core/timing. A transport anchor (ctx time, abs tick,
// ticks per second) maps ticks to audio time; seek re-anchors and re-queues everything that
// has not started yet in the same call, so there are no stuck or doubled notes.

import { makeAnchor, tickAt, timeAt, windowEvents } from "../core/schedule.js";
import { barBeatOf, ticksPerSecond, ticksToSeconds } from "../core/timing.js";
import { clampBpm } from "../core/practice.js";
import { createAudio } from "./context.js";
import { createSynth } from "./synth.js";

const TIMER_MS = 25;
const LOOKAHEAD_S = 0.12;
const START_DELAY_S = 0.05;

export function createEngine({
  audio = createAudio(),
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  makeSynth = createSynth,
} = {}) {
  let tl = null; // resolved timeline from core/timeline
  let bpm = null; // BPM counted in tl.tempo.beatUnit, from the song until PR 8d adds setBpm
  let synth = null;
  let playing = false;
  let heldTick = 0; // song tick while not playing
  let anchor = null;
  let origin = 0; // tick where this run of scheduling started
  let scanned = 0; // everything before this abs tick is already scheduled
  let timer = null;
  const listeners = {};
  const pos = { tick: 0, bar: 1, beat: 1, seconds: 0 };

  const tps = () => ticksPerSecond(tl.tempo, bpm);
  const clampTick = (t) => Math.min(tl.lengthTicks, Math.max(0, t));
  const emit = (name, data) => (listeners[name] ?? []).slice().forEach((fn) => fn(data));
  const pedalAt = (tick) => tl.pedal.some((r) => tick >= r.startTick && tick < r.endTick);

  /** Song tick at the audio clock (`heard` subtracts output latency: what is audible now). */
  function tickNow(heard) {
    if (!playing) return heldTick;
    const t = audio.context.currentTime - (heard ? audio.outputLatency() : 0);
    return clampTick(Math.max(tickAt(anchor, t), origin));
  }

  function schedule(from, to, now) {
    for (const e of windowEvents(tl.notes, Math.max(from, origin), to, null)) {
      const dur = e.absEnd - e.absTick;
      synth.playNote({
        midi: e.note.midi,
        vel: e.note.vel ?? 0.7,
        when: Math.max(timeAt(anchor, e.absTick), now),
        dur: dur / anchor.tps,
        pedal: pedalAt(e.note.tick + dur),
      });
    }
  }

  function pump() {
    if (!playing) return;
    const now = audio.context.currentTime;
    if (tickAt(anchor, now - audio.outputLatency()) >= tl.lengthTicks) {
      stop();
      emit("ended", {});
      return;
    }
    const horizon = tickAt(anchor, now + LOOKAHEAD_S);
    schedule(scanned, horizon, now);
    scanned = Math.max(scanned, horizon);
    timer = timers.set(pump, TIMER_MS);
  }

  /**
   * Re-anchor at `songTick` right now: cancel what has not started, optionally fade what sounds,
   * and queue again from the new anchor in the same call.
   */
  function retime(songTick, { releaseSounding = false } = {}) {
    const now = audio.context.currentTime;
    synth.cancelPending(now, { releaseSounding });
    origin = clampTick(songTick);
    anchor = makeAnchor(now, origin, tps());
    scanned = origin;
    timers.clear(timer);
    pump();
  }

  function halt() {
    playing = false;
    timers.clear(timer);
    synth.cancelPending(audio.context.currentTime, { releaseSounding: true });
  }

  function play() {
    if (!tl || playing) return;
    const ctx = audio.ensure(); // inside the user gesture, so autoplay policy lets it run
    synth ??= makeSynth(ctx);
    if (heldTick >= tl.lengthTicks) heldTick = 0;
    origin = heldTick;
    anchor = makeAnchor(ctx.currentTime + START_DELAY_S, origin, tps());
    scanned = origin;
    playing = true;
    emit("state", { state: "playing" });
    pump();
  }

  function pause() {
    if (!playing) return;
    heldTick = tickNow(true);
    halt();
    emit("state", { state: "paused" });
  }

  function stop() {
    if (playing) halt();
    heldTick = 0;
    emit("state", { state: "stopped" });
  }

  function seek(tick) {
    if (!tl) return;
    const t = clampTick(tick);
    if (playing) retime(t, { releaseSounding: true });
    else heldTick = t;
  }

  return {
    play,
    pause,
    stop,
    seek,

    /** Set the timeline; keeps the current position unless `tick` is given. The BPM comes from the song. */
    setTimeline(timeline, { tick } = {}) {
      const keep = tick ?? (tl ? tickNow(false) : 0);
      tl = timeline;
      bpm ??= clampBpm(tl.tempo.bpm);
      heldTick = clampTick(keep);
      if (playing) retime(heldTick, { releaseSounding: true });
    },

    /** { tick, bar, beat, seconds } at the heard audio position. The same object is reused. */
    position() {
      if (!tl) return pos;
      const tick = tickNow(true);
      const b = barBeatOf(tick, tl.meter, tl.pickupTicks, tl.tempo.beatUnit);
      pos.tick = tick;
      pos.bar = b.bar;
      pos.beat = b.beat;
      pos.seconds = ticksToSeconds(tick, tl.tempo, bpm);
      return pos;
    },

    isPlaying: () => playing,

    /** Subscribe to "state" ({ state }) and "ended". Returns an unsubscribe function. */
    on(name, fn) {
      (listeners[name] ??= []).push(fn);
      return () => {
        listeners[name] = listeners[name].filter((f) => f !== fn);
      };
    },

    dispose() {
      if (playing) halt();
      synth?.dispose();
      audio.suspend();
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    },
  };
}
