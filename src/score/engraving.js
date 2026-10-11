// Engraving rules applied on top of the base layout: stems, beams, rests computed from gaps,
// ties, tuplet brackets, grace notes and ornament signs. Pure, no DOM. Same units as layout.js:
// x in staff spaces, vertical `pos` in half-spaces above the bottom line of the staff.

import { ticksPerBar } from "../core/timing.js";

export const STEM_LENGTH = 7; // half-spaces (3.5 sp)
const MIDDLE = 4; // pos of the middle line
const GRACE_DX = 1.5;
const STUB = 1;
const REST_VALUES = [2880, 1920, 1440, 960, 720, 480, 360, 240, 180, 120, 60];

const farthest = (e) => (Math.abs(e.notes[e.notes.length - 1].pos - MIDDLE) > Math.abs(e.notes[0].pos - MIDDLE) ? e.notes[e.notes.length - 1].pos : e.notes[0].pos);

// Sets the stem side, the head offsets and the stem of one chord for a given direction.
function orient(e, dir, metrics) {
  const headW = metrics.headW;
  const low = e.notes[0].pos;
  const high = e.notes[e.notes.length - 1].pos;
  e.dir = dir;
  // Heads closer than `chordStep` half-spaces alternate sides of the stem so they do not overlap
  // (a second when engraved; up to a fourth when the heads are large to hold a name).
  const ordered = dir === "up" ? e.notes : [...e.notes].reverse();
  ordered.forEach((n, i) => {
    n.dx = i > 0 && Math.abs(n.pos - ordered[i - 1].pos) < metrics.chordStep && ordered[i - 1].dx === 0 ? (dir === "up" ? headW : -headW) : 0;
  });
  if (e.base === "whole") return;
  e.stem = dir === "up" ? { dir, dx: headW / 2, fromPos: low, toPos: Math.max(high + STEM_LENGTH, MIDDLE) } : { dir, dx: -headW / 2, fromPos: high, toPos: Math.min(low - STEM_LENGTH, MIDDLE) };
}

/** Stem direction: the note farthest from the middle line decides; with two voices in a staff they split. */
export function placeStems(events, metrics) {
  const twoVoices = new Set(events.filter((e) => e.voice === 2).map((e) => e.staff));
  for (const e of events) {
    if (e.kind !== "note") continue;
    e.fixedDir = twoVoices.has(e.staff);
    orient(e, e.fixedDir ? (e.voice === 2 ? "down" : "up") : farthest(e) >= MIDDLE ? "down" : "up", metrics);
  }
}

function perVoice(events, keep) {
  const lists = new Map();
  for (const e of events) {
    if (!keep(e)) continue;
    const k = `${e.staff}|${e.voice}`;
    if (!lists.has(k)) lists.set(k, []);
    lists.get(k).push(e);
  }
  return [...lists.values()];
}

function buildBeam(run, id, metrics) {
  const lean = run.reduce((s, e) => s + farthest(e) - MIDDLE, 0);
  const dir = run[0].fixedDir ? run[0].dir : lean >= 0 ? "down" : "up";
  for (const e of run) orient(e, dir, metrics);
  const sgn = dir === "up" ? 1 : -1;
  const last = run[run.length - 1];
  const x1 = run[0].x + run[0].stem.dx;
  const x2 = last.x + last.stem.dx;
  const t1 = run[0].stem.fromPos + sgn * STEM_LENGTH;
  const t2 = last.stem.fromPos + sgn * STEM_LENGTH;
  const slope = Math.max(-2, Math.min(2, t2 - t1));
  const at = (x) => (t1 + t2) / 2 + slope * ((x - x1) / (x2 - x1) - 0.5);
  // Lift (or lower) the whole line until every stem is at least 3 sp long.
  let shift = 0;
  for (const e of run) shift = Math.max(shift, sgn * (e.stem.fromPos + sgn * (STEM_LENGTH - 1) - at(e.x + e.stem.dx)));
  const line = (x) => at(x) + sgn * shift;
  const members = run.map((e) => ({ event: e.id, x: e.x + e.stem.dx, level: e.flags }));
  for (const e of run) {
    e.stem.toPos = line(e.x + e.stem.dx);
    e.stem.beamed = true;
  }
  const secondary = [];
  for (let level = 2; level <= 3; level += 1) {
    for (let i = 0, j; i < members.length; i = j + 1) {
      j = i;
      if (members[i].level < level) continue;
      while (j + 1 < members.length && members[j + 1].level >= level) j += 1;
      const atEnd = i === members.length - 1;
      secondary.push(j > i ? { level, x1: members[i].x, x2: members[j].x } : { level, x1: members[i].x - (atEnd ? STUB : 0), x2: members[i].x + (atEnd ? 0 : STUB) });
    }
  }
  return { id, staff: run[0].staff, voice: run[0].voice, dir, x1, x2, pos1: line(x1), pos2: line(x2), members, secondary };
}

/**
 * Beams runs of two or more adjacent eighths or shorter inside one beat group of one voice:
 * dotted-quarter groups of three in 12/8 and 6/8, one beat in the other meters. A rest or a
 * longer value ends the run. Beamed stems end on the beam line (slope at most 2 half-spaces).
 */
export function placeBeams(events, tl, metrics) {
  const groupLen = tl.meter.den === 8 && tl.meter.num % 3 === 0 ? 720 : 480;
  const groupOf = (e) => Math.floor((e.tick - tl.pickupTicks) / groupLen);
  const beams = [];
  for (const list of perVoice(events, (e) => !e.grace)) {
    let run = [];
    const flush = () => {
      if (run.length >= 2) beams.push(buildBeam(run, beams.length, metrics));
      run = [];
    };
    for (const e of list) {
      const beamable = e.kind === "note" && e.flags > 0;
      const prev = run[run.length - 1];
      if (beamable && (!prev || (prev.tick + prev.dur === e.tick && groupOf(prev) === groupOf(e)))) run.push(e);
      else {
        flush();
        if (beamable) run.push(e);
      }
    }
    flush();
  }
  return beams;
}

/**
 * Rests for the gaps of voice 1 in each staff that has notes (used when a level is not
 * `strictBars`). A gap is split at barlines and written with the longest values that fit.
 */
export function computedRests(events, tl, shapeOf) {
  const barLen = ticksPerBar(tl.meter);
  const nextBarline = (t) => (t < tl.pickupTicks ? tl.pickupTicks : tl.pickupTicks + (Math.floor((t - tl.pickupTicks) / barLen) + 1) * barLen);
  const out = [];
  for (const list of perVoice(events, (e) => !e.grace && e.voice === 1)) {
    const { staff, hand } = list[0];
    const fill = (from, to) => {
      for (let t = from; t < to; ) {
        const end = Math.min(to, nextBarline(t));
        for (let rem = end - t, v; rem >= 60; rem -= v, t += v) {
          v = REST_VALUES.find((value) => value <= rem);
          out.push({ staff, hand, voice: 1, tick: t, dur: v, kind: "rest", grace: false, ...shapeOf(v), flags: 0, notes: [], computed: true });
        }
        t = end;
      }
    };
    let cursor = 0;
    for (const e of list) {
      if (e.tick > cursor) fill(cursor, e.tick);
      cursor = Math.max(cursor, e.tick + e.dur);
    }
    if (cursor < tl.lengthTicks) fill(cursor, tl.lengthTicks);
  }
  return out;
}

/** A tie runs from a note marked `tie: true` to the next note of the same pitch in the same voice. */
export function placeTies(events, metrics) {
  const ties = [];
  for (const list of perVoice(events, (e) => !e.grace && e.kind === "note")) {
    list.forEach((e, i) => {
      for (const n of e.notes) {
        if (!n.tie) continue;
        const next = list.find((f, j) => j > i && f.tick >= e.tick + e.dur && f.notes.some((m) => m.midi === n.midi));
        if (!next) continue;
        const m = next.notes.find((q) => q.midi === n.midi);
        ties.push({ staff: e.staff, from: e.id, to: next.id, midi: n.midi, x1: e.x + n.dx + metrics.headW / 2, x2: next.x + m.dx - metrics.headW / 2, pos: n.pos, dir: e.dir === "up" ? "down" : "up" });
      }
    });
  }
  return ties;
}

/** Brackets for runs of `n` consecutive events sharing a tuplet ratio, on the stem side of the first event. */
export function placeTuplets(events, metrics) {
  const out = [];
  for (const list of perVoice(events, (e) => !e.grace)) {
    let run = [];
    const flush = () => {
      const n = run[0]?.tuplet.n;
      for (let i = 0; n && i + n <= run.length; i += n) {
        const group = run.slice(i, i + n);
        const dir = group[0].dir ?? "up";
        const reach = group.map((e) => (e.kind === "rest" ? MIDDLE : (e.stem?.toPos ?? (dir === "up" ? e.notes[e.notes.length - 1].pos : e.notes[0].pos))));
        out.push({ staff: group[0].staff, voice: group[0].voice, n, inSpaceOf: group[0].tuplet.inSpaceOf, dir, x1: group[0].x - metrics.headW / 2, x2: group[n - 1].x + metrics.headW / 2, pos: dir === "up" ? Math.max(...reach) + 1.5 : Math.min(...reach) - 1.5, beamed: group.every((e) => e.stem?.beamed === true) });
      }
      run = [];
    };
    for (const e of list) {
      const same = run.length > 0 && run[0].tuplet.n === e.tuplet?.n && run[0].tuplet.inSpaceOf === e.tuplet?.inSpaceOf;
      if (e.tuplet && (run.length === 0 || same)) run.push(e);
      else {
        flush();
        if (e.tuplet) run.push(e);
      }
    }
    flush();
  }
  return out;
}

/** Grace notes keep their written tick; they are small and drawn just before the main note. */
export function placeGraces(events) {
  const groups = new Map();
  for (const e of events) {
    if (!e.grace) continue;
    e.small = true;
    const k = `${e.staff}|${e.tick}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const list of groups.values()) list.forEach((e, i) => (e.x -= (list.length - i) * GRACE_DX));
}

/**
 * Ornament signs above the note (or above its stem). A `fioritura` bracket also spans the
 * following notes of the same voice whose `role` is "ornament".
 */
export function placeOrnaments(events, metrics) {
  const out = [];
  for (const list of perVoice(events, (e) => e.kind === "note")) {
    list.forEach((e, i) => {
      const n = e.notes.find((q) => q.ornament);
      if (!n) return;
      let x2 = e.x + metrics.headW / 2;
      if (n.ornament === "fioritura") {
        for (let j = i + 1; j < list.length && list[j].notes.every((q) => q.role === "ornament"); j += 1) x2 = list[j].x + metrics.headW / 2;
      }
      const top = e.dir === "up" && e.stem ? e.stem.toPos : e.notes[e.notes.length - 1].pos;
      out.push({ kind: n.ornament, staff: e.staff, event: e.id, x: e.x, x1: e.x - metrics.headW / 2, x2, pos: Math.max(8, top) + 3 });
    });
  }
  return out;
}
