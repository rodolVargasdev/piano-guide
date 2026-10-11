// Pure transposition of a song level to another major tonic. Intervals are preserved exactly and
// every pitch keeps the letter its degree asks for (D5 in E major becomes Bb4 in C, never A#4). No DOM,
// no audio, no dependency.
import { inPianoRange, parsePitch, transposeInterval } from "../core/pitch.js";
import { parseChord } from "../core/chords.js";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const HAND_NAME = { R: "right", L: "left" };
const CENTER = { R: 60, L: 48 }; // C4 for the right hand, C3 for the left
const SHIFTS = [0, 12, -12];
const mod = (n, m) => ((n % m) + m) % m;
const withoutOctave = (pitch) => pitch.replace(/-?\d+$/, "");

/**
 * The smallest move between two tonics as { steps, semitones }: |semitones| <= 6 and a tritone goes
 * down. `steps` are letter steps, so E to C is { steps: -2, semitones: -4 }. Throws RangeError for a
 * name that is not a tonic.
 */
export function smallestMove(fromTonic, toTonic) {
  const from = parsePitch(`${fromTonic}4`);
  const to = parsePitch(`${toTonic}4`);
  if (!from || !to) throw new RangeError(`Not a tonic name: ${from ? toTonic : fromTonic}`);
  let semitones = mod(to.midi - from.midi, 12);
  if (semitones >= 6) semitones -= 12;
  const raw = mod(LETTERS.indexOf(to.letter) - LETTERS.indexOf(from.letter), 7);
  // The letter steps that land exactly on the target name (the other candidates fall an octave off).
  for (const steps of [raw, raw - 7, raw + 7, raw - 14]) {
    const landed = transposeInterval(`${fromTonic}4`, steps, semitones);
    if (landed !== null && withoutOctave(landed) === toTonic) return { steps, semitones };
  }
  throw new RangeError(`Cannot move ${fromTonic} to ${toTonic}`);
}

const CHORD_RE = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/;

/**
 * Re-spells the root and the slash bass of a chord symbol by `move`, keeping the suffix:
 * "C#m" moved E to C is "Am". Null when the text is not shaped like a chord symbol or a root would
 * need more than one accidental.
 */
export function transposeChordSymbol(symbol, move) {
  const m = typeof symbol === "string" ? CHORD_RE.exec(symbol.trim()) : null;
  if (!m) return null;
  const shift = (name) => {
    const moved = transposeInterval(`${name}4`, move.steps, move.semitones);
    const text = moved === null ? null : withoutOctave(moved);
    return text === null || text.length > 2 ? null : text; // a root like F## cannot be written as a symbol
  };
  const root = shift(m[1]);
  const bass = m[3] === undefined ? undefined : shift(m[3]);
  if (root === null || bass === null) return null;
  return `${root}${m[2]}${bass === undefined ? "" : `/${bass}`}`;
}

function respellSymbol(symbol, move) {
  const moved = transposeChordSymbol(symbol, move);
  if (moved !== null) return moved;
  if (parseChord(symbol) === null) return symbol; // not a chord symbol (for example a rest marker): leave it
  throw new RangeError(`Cannot respell chord ${symbol} after the move`);
}

// The octave shift of one hand: reject every candidate that leaves A0 to C8, then take the one whose
// mean pitch is closest to the hand's center, ties to 0 and then to the lower shift.
function octaveShift(hand, midis) {
  if (midis.length === 0) return 0;
  const alive = SHIFTS.filter((s) => midis.every((m) => inPianoRange(m + s)));
  if (alive.length === 0) throw new RangeError(`No octave shift keeps the ${HAND_NAME[hand]} hand inside A0 to C8`);
  const mean = midis.reduce((a, m) => a + m, 0) / midis.length;
  const rank = (s) => [Math.abs(mean + s - CENTER[hand]), s === 0 ? 0 : 1, s];
  return alive.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  })[0];
}

/**
 * transposeSong(song, levelId, targetTonic) returns a new song holding only `levelId`, moved to
 * `targetTonic`: pitches and chord symbols re-spelled, an octave shift chosen per hand, authored fingers,
 * finger sources and display labels dropped (they belong to the original key), the `transposeTo` list and
 * the hand-position notes of the lesson removed. Every other top-level field, `visibility` included, is
 * copied, so a transposed private song is still silent. A target equal to the source key returns the
 * notes unchanged. Throws RangeError for an unknown level or tonic, a note that cannot be spelled, or a
 * hand that no octave shift fits inside A0 to C8.
 */
export function transposeSong(song, levelId, targetTonic) {
  const level = song?.levels?.[levelId];
  if (!level) throw new RangeError(`Unknown level: ${levelId}`);
  const move = smallestMove(song.key.tonic, targetTonic);
  const identity = move.steps === 0 && move.semitones === 0;

  let notes = structuredClone(level.notes);
  if (!identity) {
    notes = notes.map((n) => {
      const { finger, fingeringSource, label, ...rest } = n;
      if (n.rest) return rest;
      const pitch = transposeInterval(n.pitch, move.steps, move.semitones);
      if (pitch === null) throw new RangeError(`Cannot spell ${n.pitch} after moving to ${targetTonic}`);
      return { ...rest, pitch };
    });
    for (const hand of ["R", "L"]) {
      const own = notes.filter((n) => n.hand === hand && !n.rest);
      const shift = octaveShift(hand, own.map((n) => parsePitch(n.pitch).midi));
      // An octave is seven letter steps and twelve semitones.
      if (shift !== 0) for (const n of own) n.pitch = transposeInterval(n.pitch, (shift / 12) * 7, shift);
    }
  }

  const respell = (list) => (identity ? structuredClone(list) : list.map((c) => ({ ...c, symbol: respellSymbol(c.symbol, move) })));
  const out = structuredClone(song);
  out.key = { ...song.key, tonic: targetTonic };
  if (song.chords) out.chords = respell(song.chords);
  const moved = { ...structuredClone(level), notes };
  if (level.chords) moved.chords = respell(level.chords);
  if (moved.learn) {
    delete moved.learn.transposeTo;
    if (Object.keys(moved.learn).length === 0) delete moved.learn;
  }
  out.levels = { [levelId]: moved };
  out.defaultLevel = levelId;
  const lesson = song.lesson?.[levelId];
  if (lesson) {
    const next = structuredClone(lesson);
    if (!identity) {
      if (Array.isArray(next.chordsUsed)) next.chordsUsed = next.chordsUsed.map((s) => respellSymbol(s, move));
      next.handPositions = [];
    }
    out.lesson = { [levelId]: next };
  } else delete out.lesson;
  return out;
}
