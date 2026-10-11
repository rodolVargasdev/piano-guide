// Pure scheduling math: transport anchors and look-ahead windows with loop wrap.
// No DOM, no Web Audio. The engine owns the clock and feeds ctx times in.
//
// Absolute ticks ("abs ticks") grow monotonically across loop passes. A loop is
// { startTick, endTick } on the song timeline, half-open [startTick, endTick).
// Before startTick the abs tick equals the song tick; from startTick on, each
// pass adds one loop length, so already queued notes never need re-queueing at a wrap.

/** Anchor: at audio time `ctxTime` the transport was at abs tick `tick`, moving at `tps` ticks per second. */
export function makeAnchor(ctxTime, tick, tps) {
  return { ctxTime, tick, tps };
}

/** Abs tick at audio time `ctxTime`. */
export function tickAt(anchor, ctxTime) {
  return anchor.tick + (ctxTime - anchor.ctxTime) * anchor.tps;
}

/** Audio time at which abs tick `absTick` sounds. */
export function timeAt(anchor, absTick) {
  return anchor.ctxTime + (absTick - anchor.tick) / anchor.tps;
}

/** New anchor at `ctxTime` with a new speed that keeps the current tick (BPM change). */
export function reanchor(anchor, ctxTime, tps) {
  return makeAnchor(ctxTime, tickAt(anchor, ctxTime), tps);
}

const loopLength = (loop) => (loop ? loop.endTick - loop.startTick : 0);
const usable = (loop) => loopLength(loop) > 0;

/** Song tick for an abs tick: identity before the loop, wrapped inside it. */
export function songTickOf(absTick, loop) {
  if (!usable(loop) || absTick < loop.startTick) return absTick;
  const len = loopLength(loop);
  return loop.startTick + ((absTick - loop.startTick) % len);
}

function pushNote(out, note, absTick, absEnd) {
  out.push({ note, absTick, absEnd });
}

/**
 * Playable occurrences whose onset lies in [fromAbsTick, toAbsTick), sorted by abs tick.
 * `notes` MUST be sorted by tick. Rest events are skipped.
 * Without a loop an occurrence is { note, absTick: tick, absEnd: tick + dur }.
 * With a loop, only notes starting inside [startTick, endTick) repeat, once per pass;
 * a note straddling the loop end is cut at the loop end, and a note starting exactly at
 * the loop end is not part of the loop (the boundary belongs to the next pass's start).
 * Notes before the loop play once in the identity region.
 */
export function windowEvents(notes, fromAbsTick, toAbsTick, loop) {
  const out = [];
  if (!(toAbsTick > fromAbsTick)) return out;
  const looping = usable(loop);
  const identityEnd = looping ? Math.min(toAbsTick, loop.startTick) : toAbsTick;

  for (const n of notes) {
    if (n.tick >= identityEnd) break;
    if (n.rest || n.tick < fromAbsTick) continue;
    pushNote(out, n, n.tick, n.tick + n.dur);
  }
  if (!looping || toAbsTick <= loop.startTick) return out;

  const len = loopLength(loop);
  const from = Math.max(fromAbsTick, loop.startTick);
  const firstPass = Math.floor((from - loop.startTick) / len);
  const lastPass = Math.floor((toAbsTick - 1e-9 - loop.startTick) / len);
  for (let pass = firstPass; pass <= lastPass; pass += 1) {
    const offset = pass * len;
    for (const n of notes) {
      if (n.tick >= loop.endTick) break;
      if (n.rest || n.tick < loop.startTick) continue;
      const absTick = n.tick + offset;
      if (absTick < from || absTick >= toAbsTick) continue;
      pushNote(out, n, absTick, absTick + Math.min(n.dur, loop.endTick - n.tick));
    }
  }
  return out;
}
