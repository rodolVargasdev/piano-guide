// Pure musical-time helpers. No DOM, no Web Audio, no dependencies.
// Time unit: integer ticks, PPQ = 480 per quarter note (a code constant, not a file field).

export const PPQ = 480;

const BEAT_UNIT_TICKS = Object.freeze({
  quarter: PPQ,
  eighth: PPQ / 2,
  "dotted-quarter": PPQ * 1.5,
  half: PPQ * 2,
});

/** Ticks in one bar of `meter` = { num, den }. 4/4 gives 1920, 12/8 gives 2880. */
export function ticksPerBar(meter) {
  return (meter.num * PPQ * 4) / meter.den;
}

/** Ticks in one beat of the given unit: quarter 480, eighth 240, dotted-quarter 720, half 960. */
export function ticksPerBeatUnit(unit) {
  const ticks = BEAT_UNIT_TICKS[unit];
  if (ticks === undefined) throw new RangeError(`Unknown beat unit: ${unit}`);
  return ticks;
}

/** Ticks per second for `bpm` counted in `tempo.beatUnit`. */
export function ticksPerSecond(tempo, bpm) {
  return (bpm * ticksPerBeatUnit(tempo.beatUnit)) / 60;
}

export function ticksToSeconds(ticks, tempo, bpm) {
  return ticks / ticksPerSecond(tempo, bpm);
}

export function secondsToTicks(seconds, tempo, bpm) {
  return seconds * ticksPerSecond(tempo, bpm);
}

/**
 * Bar and beat of a tick. The pickup (anacrusis) is bar 0 and is numbered as the
 * end of a virtual full bar, so a one-beat pickup in 4/4 sits on beat 4 of bar 0.
 * Without a pickup, bar 1 starts at tick 0.
 * Returns { bar, beat (1-based, integer), tickInBeat, tickInBar }.
 */
export function barBeatOf(tick, meter, pickupTicks, beatUnit) {
  const barLen = ticksPerBar(meter);
  const beatLen = ticksPerBeatUnit(beatUnit);
  let bar;
  let tickInBar;
  if (tick < pickupTicks) {
    bar = 0;
    tickInBar = tick + barLen - pickupTicks;
  } else {
    const rel = tick - pickupTicks;
    bar = Math.floor(rel / barLen) + 1;
    tickInBar = rel - (bar - 1) * barLen;
  }
  const beatIndex = Math.floor(tickInBar / beatLen);
  return { bar, beat: beatIndex + 1, tickInBeat: tickInBar - beatIndex * beatLen, tickInBar };
}

/**
 * Inverse of barBeatOf: the tick at the start of `beat` in `bar`
 * (plus `tickInBeat` when given, so the round trip is exact).
 */
export function tickOfBarBeat({ bar, beat, tickInBeat = 0 }, meter, pickupTicks, beatUnit) {
  const barLen = ticksPerBar(meter);
  const beatLen = ticksPerBeatUnit(beatUnit);
  const barStart = pickupTicks + (bar - 1) * barLen;
  return barStart + (beat - 1) * beatLen + tickInBeat;
}

/**
 * Metronome grid: one entry per beat unit in [fromTick, toTick), with `accent`
 * true on the first beat of each bar. The pickup region is on the grid too, but
 * its virtual downbeat lies before tick 0, so the pickup itself has no accent.
 */
export function beatGrid(meter, pickupTicks, beatUnit, fromTick, toTick) {
  const barLen = ticksPerBar(meter);
  const beatLen = ticksPerBeatUnit(beatUnit);
  const out = [];
  const from = Math.max(fromTick, 0);
  // Bar boundaries sit at pickupTicks + k * barLen for integer k (k = -1 is the virtual pickup bar).
  let k = Math.floor((from - pickupTicks) / barLen);
  for (; pickupTicks + k * barLen < toTick; k += 1) {
    const barStart = pickupTicks + k * barLen;
    for (let j = 0; j * beatLen < barLen; j += 1) {
      const tick = barStart + j * beatLen;
      if (tick >= from && tick < toTick) out.push({ tick, accent: j === 0 });
    }
  }
  return out;
}
