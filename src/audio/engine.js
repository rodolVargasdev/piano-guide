// Playback engine: the single owner of musical time. The Web Audio clock is the only clock;
// views read engine.position() once per frame and never keep time of their own.
//
// A 25 ms timer schedules every note and click that falls inside a short look-ahead window,
// using the pure helpers in core/schedule and core/timing. A transport anchor
// (ctx time, abs tick, ticks per second) maps ticks to audio time; BPM change and seek
// re-anchor and re-queue everything that has not started yet in the same call.

import { makeAnchor, tickAt, timeAt, windowEvents, songTickOf } from "../core/schedule.js";
import { beatGrid, barBeatOf, ticksPerBar, ticksPerBeatUnit, ticksPerSecond, ticksToSeconds } from "../core/timing.js";
import { clampBpm, effectiveBpm, passesBetween, audibleNotes } from "../core/practice.js";
import { createAudio } from "./context.js";
import { createSynth } from "./synth.js";
import { createMetronome } from "./metronome.js";

const TIMER_MS = 25;
const LOOKAHEAD_S = 0.12;
const HIDDEN_LOOKAHEAD_S = 1.5; // background timers run about once a second
const START_DELAY_S = 0.05;

export function createEngine({
  audio = createAudio(),
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  makeSynth = createSynth,
  makeMetronome = createMetronome,
  document = globalThis.document,
} = {}) {
  let tl = null; // resolved timeline from core/timeline
  let grid = []; // metronome beats as pseudo-notes
  let audible = []; // notes of hands that are not muted
  let loop = null; // { startTick, endTick } on the song timeline
  let handModes = { L: { muted: false, hidden: false }, R: { muted: false, hidden: false } };
  let lookahead = LOOKAHEAD_S;
  let lastAbs = 0; // abs tick at the previous pump, for loop-pass detection
  let userBpm = null;
  let slow = false;
  let metro = { enabled: false, countIn: false, subdivision: false };
  let synth = null;
  let click = null;
  let playing = false;
  let heldTick = 0; // song tick while not playing
  let anchor = null;
  let origin = 0; // tick where this run of scheduling started (count-in clicks lie before it)
  let scanned = 0; // everything before this abs tick is already scheduled
  let timer = null;
  const listeners = {};
  const pos = { tick: 0, bar: 1, beat: 1, seconds: 0 };

  const bpm = () => effectiveBpm({ userBpm, slowMode: slow });
  const tps = () => ticksPerSecond(tl.tempo, bpm());
  const clampTick = (t) => Math.min(tl.lengthTicks, Math.max(0, t));
  /** A song tick kept inside the song and, with a loop active, before the loop end. */
  const place = (t) => (loop && t >= loop.endTick ? loop.startTick : clampTick(t));
  const emit = (name, data) => (listeners[name] ?? []).slice().forEach((fn) => fn(data));
  const pedalAt = (tick) => tl.pedal.some((r) => tick >= r.startTick && tick < r.endTick);

  /** Song tick at the audio clock (`heard` subtracts output latency: what is audible now). */
  function tickNow(heard) {
    if (!playing) return heldTick;
    const ctx = audio.context;
    const t = ctx.currentTime - (heard ? audio.outputLatency() : 0);
    return clampTick(songTickOf(Math.max(tickAt(anchor, t), origin), loop));
  }

  function schedule(from, to, now) {
    const lo = Math.max(from, origin);
    for (const e of windowEvents(audible, lo, to, loop)) {
      const dur = e.absEnd - e.absTick;
      synth.playNote({
        midi: e.note.midi,
        vel: e.note.vel ?? 0.7,
        when: Math.max(timeAt(anchor, e.absTick), now),
        dur: dur / anchor.tps,
        pedal: pedalAt(e.note.tick + dur),
      });
    }
    const beatTicks = ticksPerBeatUnit(tl.tempo.beatUnit);
    if (metro.enabled) {
      for (const e of windowEvents(grid, lo, to, loop)) {
        const when = Math.max(timeAt(anchor, e.absTick), now);
        click.click(when, { accent: e.note.accent });
        if (metro.subdivision) click.click(when + beatTicks / 2 / anchor.tps, { sub: true });
      }
    }
    if (metro.countIn && anchor.tick < origin) {
      const beats = Math.ceil(ticksPerBar(tl.meter) / beatTicks);
      for (let k = 0; k < beats; k += 1) {
        const abs = anchor.tick + k * beatTicks;
        if (abs >= from && abs < Math.min(to, origin)) click.click(Math.max(timeAt(anchor, abs), now), { accent: k === 0 });
      }
    }
  }

  function pump() {
    if (!playing) return;
    const ctx = audio.context;
    const now = ctx.currentTime;
    const heard = tickAt(anchor, now - audio.outputLatency());
    if (!loop && heard >= tl.lengthTicks) {
      stop();
      emit("ended", {});
      return;
    }
    // One event per completed pass; a seek or tempo change restarts the count from the new anchor.
    for (let n = passesBetween(lastAbs, heard, loop); n > 0; n -= 1) emit("loop-pass", {});
    lastAbs = Math.max(lastAbs, heard);
    const horizon = tickAt(anchor, now + lookahead);
    schedule(scanned, horizon, now);
    scanned = Math.max(scanned, horizon);
    timer = timers.set(pump, TIMER_MS);
  }

  /**
   * Re-anchor at `songTick` right now: cancel what has not started, optionally fade what sounds,
   * and queue again from the new anchor in the same call (no stuck or doubled notes).
   */
  function retime(songTick, { releaseSounding = false } = {}) {
    const now = audio.context.currentTime;
    synth.cancelPending(now, { releaseSounding });
    click.cancelPending(now);
    origin = place(songTick);
    anchor = makeAnchor(now, origin, tps());
    scanned = origin;
    lastAbs = origin;
    timers.clear(timer);
    pump();
  }

  function halt() {
    playing = false;
    timers.clear(timer);
    const now = audio.context.currentTime;
    synth.cancelPending(now, { releaseSounding: true });
    click.cancelPending(now);
  }

  function play() {
    if (!tl || playing) return;
    const ctx = audio.ensure(); // inside the user gesture, so autoplay policy lets it run
    if (!synth) {
      synth = makeSynth(ctx);
      click = makeMetronome(ctx);
    }
    heldTick = heldTick >= tl.lengthTicks ? (loop ? loop.startTick : 0) : place(heldTick);
    origin = heldTick;
    const lead = metro.countIn ? ticksPerBar(tl.meter) : 0;
    anchor = makeAnchor(ctx.currentTime + START_DELAY_S, origin - lead, tps());
    scanned = anchor.tick;
    lastAbs = anchor.tick;
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
    heldTick = loop ? loop.startTick : 0;
    emit("state", { state: "stopped" });
  }

  function seek(tick) {
    if (!tl) return;
    const t = place(tick);
    if (playing) retime(t, { releaseSounding: true });
    else heldTick = t;
  }

  /** Apply a change that alters timing or the note set: keep the musical position. */
  function refresh(opts) {
    if (playing) retime(tickNow(false), opts);
  }

  function onVisibility() {
    lookahead = document.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S;
  }
  document?.addEventListener?.("visibilitychange", onVisibility);

  return {
    play,
    pause,
    stop,
    seek,

    /** Set the timeline; keeps the current position unless `tick` is given. Default BPM comes from the song. */
    setTimeline(timeline, { tick } = {}) {
      const keep = tick ?? (tl ? tickNow(false) : 0);
      tl = timeline;
      if (userBpm === null) userBpm = clampBpm(tl.tempo.bpm);
      grid = beatGrid(tl.meter, tl.pickupTicks, tl.tempo.beatUnit, 0, tl.lengthTicks).map((g) => ({ tick: g.tick, dur: 1, accent: g.accent }));
      audible = audibleNotes(tl.notes, handModes);
      heldTick = place(keep);
      if (playing) retime(heldTick, { releaseSounding: true });
    },

    /** Set the user BPM (clamped to 20-240) and return the clamped value. */
    setBpm(n) {
      userBpm = clampBpm(n);
      if (tl) refresh();
      return userBpm;
    },
    getBpm: () => userBpm,

    setSlow(on) {
      slow = Boolean(on);
      if (tl) refresh();
    },

    /** Loop { startTick, endTick } (already normalized, see core/practice) or null. Sounding notes play on. */
    setLoop(range) {
      const cur = tl ? tickNow(false) : 0; // song tick under the old loop
      loop = range ? { startTick: range.startTick, endTick: range.endTick } : null;
      if (!tl) return;
      if (playing) retime(cur);
      else heldTick = place(heldTick);
    },

    /** { L: { muted, hidden }, R: { muted, hidden } }. Muting fades that hand's sounding notes; hiding is for views. */
    setHandModes(modes) {
      const old = handModes;
      handModes = { L: { ...old.L, ...modes.L }, R: { ...old.R, ...modes.R } };
      if (!tl) return;
      audible = audibleNotes(tl.notes, handModes);
      const newlyMuted = ["L", "R"].some((h) => handModes[h].muted && !old[h].muted);
      if (playing) retime(tickNow(false), { releaseSounding: newlyMuted });
    },

    /** Merge { enabled, countIn, subdivision }. The count-in applies to the next play(). */
    setMetronome(cfg) {
      metro = { ...metro, ...cfg };
      if (tl) refresh();
    },

    /** { tick, bar, beat, seconds } at the heard audio position. The same object is reused. */
    position() {
      if (!tl) return pos;
      const tick = tickNow(true);
      const b = barBeatOf(tick, tl.meter, tl.pickupTicks, tl.tempo.beatUnit);
      pos.tick = tick;
      pos.bar = b.bar;
      pos.beat = b.beat;
      pos.seconds = ticksToSeconds(tick, tl.tempo, bpm());
      return pos;
    },

    isPlaying: () => playing,

    /** Subscribe to "state" ({ state }), "loop-pass" and "ended". Returns an unsubscribe function. */
    on(name, fn) {
      (listeners[name] ??= []).push(fn);
      return () => {
        listeners[name] = listeners[name].filter((f) => f !== fn);
      };
    },

    dispose() {
      if (playing) halt();
      document?.removeEventListener?.("visibilitychange", onVisibility);
      synth?.dispose();
      click?.dispose();
      audio.suspend();
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    },
  };
}
