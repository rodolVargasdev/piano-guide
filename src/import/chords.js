// Pure chord derivation for the Hooktheory converter. A source chord has no quality name: it is
// described by a scale degree (`root`), `type` (5 triad, 7 seventh), `inversion`, `applied`
// (0 none, 5 secondary dominant, 7 secondary leading-tone chord), `borrowed` (a mode name or
// empty), `adds`, `suspensions` and `alterations`. This module turns those fields into the chord
// symbol (spelled in the song key, written with the core/chords.js suffixes so parseChord reads it)
// and a roman numeral. No filesystem, no DOM, no dependency.
import { MAJOR_STEPS, parsePitch } from "../core/pitch.js";
import { parseChord } from "../core/chords.js";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const ACCIDENTAL = { "-2": "bb", "-1": "b", 0: "", 1: "#", 2: "##" };

/** Semitones of the seven degrees above the tonic, for the song mode and each borrowable mode. */
const MODES = {
  "": MAJOR_STEPS,
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
};

// Intervals above the root (semitones of the third, fifth and optional seventh) to a chord suffix.
const TRIADS = { "4,7": "", "3,7": "m", "3,6": "dim", "4,8": "aug" };
const SEVENTHS = { "4,7,10": "7", "4,7,11": "maj7", "3,7,10": "m7", "3,6,10": "m7b5", "3,6,9": "dim7" };
const MINOR_LIKE = new Set(["m", "dim", "m7", "m7b5", "dim7"]);
const ROMAN_SUFFIX = { "": "", m: "", dim: "dim", aug: "aug", 7: "7", maj7: "maj7", m7: "7", m7b5: "m7b5", dim7: "dim7", sus2: "sus2", sus4: "sus4", add9: "add9" };
const mod12 = (n) => ((n % 12) + 12) % 12;

// Chord tones of the degree stacked in thirds inside the scale, as semitones above the chord root.
function stacked(scale, degree, count) {
  const at = (k) => {
    const i = degree - 1 + 2 * k;
    return scale[i % 7] + 12 * Math.floor(i / 7);
  };
  return Array.from({ length: count - 1 }, (_, k) => at(k + 1) - at(0));
}

const isEmptyList = (v) => v === undefined || (Array.isArray(v) && v.length === 0);

/**
 * deriveChord(chord, key, path) -> { ok: true, symbol, roman, rootName } or { ok: false, errors }.
 * `key` is { tonic, mode: "major" }; `path` prefixes every error. Unsupported values fail with the
 * path of the offending field instead of guessing.
 */
export function deriveChord(chord, key, path) {
  const errors = [];
  const bad = (field, message) => errors.push({ path: `${path}.${field}`, message });
  const tonic = parsePitch(`${key?.tonic}4`);
  if (!tonic || key.mode !== "major") return { ok: false, errors: [{ path: `${path}`, message: "chords need a major key" }] };

  const { root, type, inversion = 0, applied = 0, borrowed = "", adds, suspensions, alterations } = chord ?? {};
  if (!Number.isInteger(root) || root < 1 || root > 7) bad("root", "root must be a scale degree from 1 to 7");
  if (type !== 5 && type !== 7) bad("type", "type must be 5 (triad) or 7 (seventh chord)");
  if (![0, 1, 2, 3].includes(inversion)) bad("inversion", "inversion must be 0 to 3");
  else if (inversion === 3 && type !== 7) bad("inversion", "inversion 3 needs a seventh chord");
  if (![0, 5, 7].includes(applied)) bad("applied", "applied must be 0, 5 or 7");
  if (!Object.hasOwn(MODES, borrowed)) bad("borrowed", `unsupported borrowed mode "${borrowed}"`);
  if (!isEmptyList(adds) && !(Array.isArray(adds) && adds.length === 1 && adds[0] === 9)) bad("adds", "only add 9 is supported");
  if (!isEmptyList(suspensions) && !(Array.isArray(suspensions) && suspensions.length === 1 && [2, 4].includes(suspensions[0]))) bad("suspensions", "only one suspension, 2 or 4, is supported");
  if (!isEmptyList(alterations) && !(Array.isArray(alterations) && alterations.length === 1 && alterations[0] === "#5")) bad("alterations", "only a raised fifth (#5) is supported");
  for (const f of ["omits", "substitutions"]) if (!isEmptyList(chord?.[f])) bad(f, `${f} are not supported`);
  if (chord?.alternate !== undefined && chord.alternate !== "") bad("alternate", "alternate chords are not supported");
  if (errors.length) return { ok: false, errors };

  const scale = MODES[borrowed];
  const added = adds?.[0] === 9;
  const sus = suspensions?.[0];
  const raised = alterations?.[0] === "#5";

  // Root position of the chord: semitones above the tonic, letter, and the base suffix.
  const degreeSemi = scale[root - 1];
  let rootSemi = degreeSemi;
  let letterIndex = LETTERS.indexOf(tonic.letter) + root - 1;
  let suffix;
  if (applied === 5) {
    rootSemi += 7;
    letterIndex += 4;
    suffix = type === 7 ? "7" : "";
  } else if (applied === 7) {
    rootSemi -= 1;
    letterIndex -= 1;
    suffix = type === 7 ? "m7b5" : "dim";
  } else {
    const key3 = stacked(scale, root, type === 7 ? 4 : 3).join(",");
    suffix = (type === 7 ? SEVENTHS : TRIADS)[key3];
    if (suffix === undefined) return { ok: false, errors: [{ path, message: `chord quality (${key3}) has no symbol` }] };
  }
  const baseSuffix = suffix;

  // Modifiers that rewrite the quality.
  if (raised) {
    if (!(type === 5 && suffix === "")) return { ok: false, errors: [{ path: `${path}.alterations`, message: "a raised fifth is only supported on a major triad" }] };
    suffix = "aug";
  }
  if (added) {
    if (!(type === 5 && suffix === "" && !sus)) return { ok: false, errors: [{ path: `${path}.adds`, message: "add 9 is only supported on a plain major triad" }] };
    if (inversion === 3) return { ok: false, errors: [{ path: `${path}.inversion`, message: "an add 9 chord has no seventh to put in the bass" }] };
    suffix = "add9";
  }
  if (sus) {
    if (type !== 5 || applied !== 0) return { ok: false, errors: [{ path: `${path}.suspensions`, message: "a suspension is only supported on a plain triad" }] };
    suffix = `sus${sus}`;
  }

  const pc = mod12(tonic.midi + rootSemi);
  const letter = LETTERS[((letterIndex % 7) + 7) % 7];
  const alter = mod12(pc - NATURAL_PC[letter] + 6) - 6;
  if (!Object.hasOwn(ACCIDENTAL, alter)) return { ok: false, errors: [{ path, message: "the chord root needs more than a double accidental" }] };
  const rootName = `${letter}${ACCIDENTAL[alter]}`;

  const plain = parseChord(`${rootName}${suffix}`);
  if (!plain) return { ok: false, errors: [{ path, message: `symbol ${rootName}${suffix} cannot be written` }] };
  const symbol = inversion > 0 ? `${plain.symbol}/${plain.names[inversion]}` : plain.symbol;
  if (!parseChord(symbol)) return { ok: false, errors: [{ path, message: `symbol ${symbol} cannot be written` }] };

  return { ok: true, symbol, roman: romanOf({ scale, root, applied, type, baseSuffix, suffix, borrowed }), rootName };
}

// Roman numeral: written case follows the chord's own quality, "b" or "#" marks a borrowed degree.
function romanOf({ scale, root, applied, type, baseSuffix, suffix, borrowed }) {
  const numeral = (degree, minorLike) => (minorLike ? ROMAN[degree - 1].toLowerCase() : ROMAN[degree - 1]);
  if (applied !== 0) {
    const target = TRIADS[stacked(scale, root, 3).join(",")];
    const targetNumeral = numeral(root, MINOR_LIKE.has(target));
    return applied === 5 ? `${type === 7 ? "V7" : "V"}/${targetNumeral}` : `${type === 7 ? "viim7b5" : "viidim"}/${targetNumeral}`;
  }
  const diff = scale[root - 1] - MAJOR_STEPS[root - 1];
  const accidental = borrowed !== "" && diff < 0 ? "b" : borrowed !== "" && diff > 0 ? "#" : "";
  return `${accidental}${numeral(root, MINOR_LIKE.has(baseSuffix))}${ROMAN_SUFFIX[suffix]}`;
}
