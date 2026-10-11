// Playback engine: the single owner of musical time. The Web Audio clock is the only clock;
// views read engine.position() once per frame and never keep time of their own.
//
// A 25 ms timer schedules every note and click that falls inside a short look-ahead window,
// using the pure helpers in core/schedule and core/timing. A transport anchor
// (ctx time, abs tick, ticks per second) maps ticks to audio time; BPM change and seek
// re-anchor and re-queue everything that has not started yet in the same call.
//
// Beyond the song transport the engine plays three other things: a bounded phrase range (Learn "Listen",
// the same clock and scheduler, one hand, its own tempo, stopping by itself), the learner's own held
// notes (startNote / releaseNote, immediate, independent of any song) and generated notes (playNotes,
// ear drills). A silent (private) song never sounds in any of them except the learner's own keys.

import { makeAnchor, tickAt, timeAt, windowEvents, songTickOf } from "../core/schedule.js";
import { beatGrid, barBeatOf, ticksPerBar, ticksPerBeatUnit, ticksPerSecond, ticksToSeconds } from "../core/timing.js";
import { clampBpm, effectiveBpm, passesBetween, schedulableNotes } from "../core/practice.js";
import { createAudio } from "./context.js";
import { createVoice } from "./voice.js";
import { createMetronome } from "./metronome.js";

const TIMER_MS = 25;
const LOOKAHEAD_S = 0.12;
const HIDDEN_LOOKAHEAD_S = 1.5; // background timers run about once a second
const START_DELAY_S = 0.05;

export function createEngine({
  audio = createAudio(),
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  makeSynth = createVoice, // the sampled piano with the oscillator synth as fallback (same interface as the synth)
  makeMetronome = createMetronome,
  document = globalThis.document,
} = {}) {
  let tl = null; // resolved timeline from core/timeline
  let grid = []; // metronome beats as pseudo-notes
  let audible = []; // schedulable notes: hands not muted, and none at all for a silent (private) timeline
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
  let range = null; // { startTick, endTick, hand, bpm, resolve, savedLoop, heldBefore } while a phrase range plays
  const held = new Map(); // learner notes: midi -> synth voice id
  const listeners = {};
  const pos = { tick: 0, bar: 1, beat: 1, seconds: 0 };

  const bpm = () => effectiveBpm({ userBpm, slowMode: slow });
  const tps = () => ticksPerSecond(tl.tempo, range ? range.bpm : bpm());
  /** Notes the scheduler may play: the transport's audible notes, or the hand's notes of the range. */
  const computeAudible = () => {
    const notes = schedulableNotes(tl, range ? {} : handModes);
    return range?.hand ? notes.filter((n) => n.hand === range.hand) : notes;
  };
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
    const hi = range ? Math.min(to, range.endTick) : to; // a range never schedules past its end
    for (const e of windowEvents(audible, lo, hi, loop)) {
      const dur = (range ? Math.min(e.absEnd, range.endTick) : e.absEnd) - e.absTick;
      synth.playNote({
        midi: e.note.midi,
        vel: e.note.vel ?? 0.7,
        when: Math.max(timeAt(anchor, e.absTick), now),
        dur: dur / anchor.tps,
        pedal: !range && pedalAt(e.note.tick + (e.absEnd - e.absTick)),
      });
    }
    const beatTicks = ticksPerBeatUnit(tl.tempo.beatUnit);
    if (metro.enabled) {
      for (const e of windowEvents(grid, lo, hi, loop)) {
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
    if (range && heard >= range.endTick) {
      const r = range;
      halt();
      heldTick = r.heldBefore;
      emit("state", { state: "stopped" });
      finishRange("completed");
      return;
    }
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
   * With `catchUp` the notes that should already be sounding at `songTick` start now for the rest of
   * their length (a level switch: the new level's held chord must not stay silent until its next onset).
   */
  function retime(songTick, { releaseSounding = false, catchUp = false } = {}) {
    const now = audio.context.currentTime;
    synth.cancelPending(now, { releaseSounding });
    click.cancelPending(now);
    origin = place(songTick);
    anchor = makeAnchor(now, origin, tps());
    scanned = origin;
    lastAbs = origin;
    if (catchUp) sustain(now);
    timers.clear(timer);
    pump();
  }

  /** Start every audible note that began before `origin` and is still sounding, cut at the loop end. */
  function sustain(now) {
    for (const n of schedulableNotes(tl, handModes)) {
      const end = Math.min(n.tick + n.dur, loop ? loop.endTick : Infinity);
      if (n.midi === null || n.tick >= origin || end <= origin) continue;
      synth.playNote({ midi: n.midi, vel: n.vel ?? 0.7, when: now, dur: (end - origin) / anchor.tps, pedal: pedalAt(n.tick + n.dur) });
    }
  }

  function halt() {
    playing = false;
    timers.clear(timer);
    const now = audio.context.currentTime;
    synth.cancelPending(now, { releaseSounding: true });
    click.cancelPending(now);
  }

  /** True unless the timeline is explicitly public (`silent === false`): the fail-closed silent rule. */
  const silentNow = () => Boolean(tl) && tl.silent !== false;

  /** The audio context, resumed inside the user gesture, with the voices created on first use. */
  function ensureVoices() {
    const ctx = audio.ensure();
    if (!synth) {
      synth = makeSynth(ctx);
      click = makeMetronome(ctx);
    }
    return ctx;
  }

  /** Ends the active range: restores the loop and the audible set, then tells the caller how it ended. */
  function finishRange(status) {
    if (!range) return;
    const r = range;
    range = null;
    loop = r.savedLoop;
    if (tl) audible = computeAudible();
    r.resolve({ status });
  }

  /** Cancels the active range (no stuck note) and resolves it as "cancelled". */
  function stopRange() {
    if (!range) return;
    const r = range;
    halt();
    heldTick = r.heldBefore;
    emit("state", { state: "stopped" });
    finishRange("cancelled");
  }

  /**
   * Plays the notes whose onsets lie in [startTick, endTick), optionally one hand, on the same clock, and
   * stops by itself at endTick. Resolves { status }: "completed", "cancelled" (stopRange, a new range, the
   * transport or a timeline change took over), "silent" (a private song: nothing is scheduled) or "empty"
   * (no onset in range: immediate, nothing sounds). Without `bpm` it plays at the slow-mode fraction of
   * the song tempo; an explicit `bpm` (the full-tempo stage) is allowed. It stops the song transport.
   */
  function playRange({ startTick, endTick, hand = null, bpm: explicit } = {}) {
    stopRange();
    if (!tl) return Promise.resolve({ status: "empty" });
    if (silentNow()) return Promise.resolve({ status: "silent" });
    const lo = Math.max(0, startTick);
    const hi = Math.min(tl.lengthTicks, endTick);
    const inRange = schedulableNotes(tl, {}).filter((n) => (hand === null || n.hand === hand) && n.tick >= lo && n.tick < hi && n.midi !== null);
    if (inRange.length === 0) return Promise.resolve({ status: "empty" });
    const ctx = ensureVoices(); // inside the user gesture
    const heldBefore = playing ? tickNow(true) : heldTick;
    if (playing) {
      halt();
      emit("state", { state: "stopped" });
    }
    return new Promise((resolve) => {
      range = {
        startTick: lo,
        endTick: hi,
        hand,
        bpm: explicit === undefined ? effectiveBpm({ userBpm: clampBpm(tl.tempo.bpm), slowMode: true }) : clampBpm(explicit),
        resolve,
        savedLoop: loop,
        heldBefore,
      };
      loop = null;
      audible = computeAudible();
      heldTick = lo;
      origin = lo;
      anchor = makeAnchor(ctx.currentTime + START_DELAY_S, origin, tps());
      scanned = anchor.tick;
      lastAbs = anchor.tick;
      playing = true;
      emit("state", { state: "playing" });
      pump();
    });
  }

  /** Starts the transport and returns { silent }: a silent song runs the clock but schedules no note. */
  function play() {
    stopRange();
    if (!tl || playing) return { silent: silentNow() };
    const ctx = ensureVoices(); // inside the user gesture, so autoplay policy lets it run
    heldTick = heldTick >= tl.lengthTicks ? (loop ? loop.startTick : 0) : place(heldTick);
    origin = heldTick;
    const lead = metro.countIn ? ticksPerBar(tl.meter) : 0;
    anchor = makeAnchor(ctx.currentTime + START_DELAY_S, origin - lead, tps());
    scanned = anchor.tick;
    lastAbs = anchor.tick;
    playing = true;
    emit("state", { state: "playing" });
    pump();
    return { silent: silentNow() };
  }

  function pause() {
    if (range) return stopRange();
    if (!playing) return;
    heldTick = tickNow(true);
    halt();
    emit("state", { state: "paused" });
  }

  function stop() {
    stopRange();
    if (playing) halt();
    heldTick = loop ? loop.startTick : 0;
    emit("state", { state: "stopped" });
  }

  function seek(tick) {
    if (!tl) return;
    stopRange();
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
      stopRange();
      const keep = tick ?? (tl ? tickNow(false) : 0);
      tl = timeline;
      if (userBpm === null) userBpm = clampBpm(tl.tempo.bpm);
      grid = beatGrid(tl.meter, tl.pickupTicks, tl.tempo.beatUnit, 0, tl.lengthTicks).map((g) => ({ tick: g.tick, dur: 1, accent: g.accent }));
      audible = computeAudible();
      heldTick = place(keep);
      if (playing) retime(heldTick, { releaseSounding: true, catchUp: true });
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
      audible = computeAudible();
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

    /** True when the loaded timeline is silent (private, or not explicitly public); false with no timeline. */
    isSilent: () => silentNow(),

    playRange,
    stopRange,
    /** True while a phrase range is playing. */
    isRangePlaying: () => range !== null,

    /**
     * The learner's own key: starts at once (the context is resumed inside the gesture), sounds until
     * releaseNote, shares the voice cap, and works whatever song is open, private or none. Pressing a
     * key that is already held restarts it.
     */
    startNote(midi, { vel = 0.7 } = {}) {
      const ctx = ensureVoices();
      if (held.has(midi)) synth.releaseHeld(held.get(midi), ctx.currentTime);
      held.set(midi, synth.startHeld({ midi, vel, when: ctx.currentTime }));
    },
    releaseNote(midi) {
      if (!held.has(midi) || !synth) return;
      synth.releaseHeld(held.get(midi), audio.context?.currentTime);
      held.delete(midi);
    },
    /** Releases every learner note (blur, route change, MIDI disconnect). */
    releaseAllNotes() {
      if (synth) for (const id of held.values()) synth.releaseHeld(id, audio.context?.currentTime);
      held.clear();
    },

    /**
     * Generated notes for ear drills: [{ midi, at, dur, vel }] with `at` and `dur` in seconds from now.
     * They never read the loaded song, so they play even when it is private; Learn modules must not use
     * this entry point (a guard test scans them).
     */
    playNotes(notes) {
      const ctx = ensureVoices();
      const t0 = ctx.currentTime + START_DELAY_S;
      for (const n of notes) synth.playNote({ midi: n.midi, vel: n.vel ?? 0.7, when: t0 + n.at, dur: n.dur });
    },
    /** Cancels generated notes that have not sounded and fades the ones that do (the learner's held notes stay). */
    stopNotes() {
      synth?.cancelPending(audio.context?.currentTime, { releaseSounding: true });
    },

    /** Subscribe to "state" ({ state }), "loop-pass" and "ended". Returns an unsubscribe function. */
    on(name, fn) {
      (listeners[name] ??= []).push(fn);
      return () => {
        listeners[name] = listeners[name].filter((f) => f !== fn);
      };
    },

    dispose() {
      stopRange();
      if (playing) halt();
      document?.removeEventListener?.("visibilitychange", onVisibility);
      held.clear();
      synth?.dispose();
      click?.dispose();
      audio.suspend();
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    },
  };
}
