// Pure converter: a parsed Hooktheory TheoryTab capture (scale degrees, 1-based beats, octave
// offsets, durations, rests, chords by degree) into a private song object that passes validateSong.
// No filesystem, no DOM, no dependency. The output is built from a whitelist of fields, in a fixed
// key order, so nothing else from the input (a lyric, a hash) can reach it and two runs give the
// same bytes once serialized.
import { PPQ } from "../core/timing.js";
import { parsePitch, inPianoRange, keyFifths, spellDegree } from "../core/pitch.js";
import { validateSong } from "../core/schema.js";
import { deriveChord } from "./chords.js";

const SECTION_ORDER = ["intro", "verse", "pre-chorus", "chorus", "bridge", "outro"];
const SD_RE = /^(##|bb|#|b)?([1-7])$/;
const ALTER = { "": 0, "#": 1, b: -1, "##": 2, bb: -2 };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LESSON = {
  summary: {
    en: "Notes and chords converted from a single user-submitted capture. Verify them by ear before relying on them.",
    es: "Las notas y los acordes provienen de una sola captura enviada por el usuario. Compruébelos de oído antes de fiarse de ellos.",
  },
  posture: {
    en: "Sit centered at the piano with relaxed shoulders, forearms level and fingers curved.",
    es: "Siéntese al centro del piano con los hombros relajados, los antebrazos a nivel y los dedos curvados.",
  },
};

/** Section names, in the fixed order the converter lays them end to end. */
export const SECTION_NAMES = SECTION_ORDER;

/**
 * convertHooktheory(source, { sourceUrl, accessed, id, title, composer }) ->
 *   { ok: true, song, warnings: string[], summary: { [section]: { notes, pitched, chords } } }
 *   | { ok: false, errors: [{ path, message }] }
 * `summary.notes` counts every source note entry (rests included); `pitched` counts the sounding ones.
 */
export function convertHooktheory(source, { sourceUrl, accessed, id = "cancer-private", title = "Cancer", composer = "My Chemical Romance" } = {}) {
  const errors = [];
  const warnings = [];
  const fail = (path, message) => void errors.push({ path, message });

  if (!isObj(source) || !isObj(source.sections)) return { ok: false, errors: [{ path: "sections", message: "the capture needs a sections object" }] };
  const names = Object.keys(source.sections);
  for (const name of names) if (!SECTION_ORDER.includes(name)) fail(`sections.${name}`, `unknown section name "${name}"`);
  const present = SECTION_ORDER.filter((n) => names.includes(n) && isObj(source.sections[n]));
  if (names.some((n) => SECTION_ORDER.includes(n) && !isObj(source.sections[n]))) fail("sections", "every section must be an object");
  if (present.length === 0 && errors.length === 0) fail("sections", "the capture has no sections");
  if (errors.length) return { ok: false, errors };

  // One key, meter and tempo for the whole song: every entry of every section must equal the first.
  const first = source.sections[present[0]];
  const key = readKey(first, `sections.${present[0]}`, fail);
  const meter = readMeter(first, `sections.${present[0]}`, fail);
  const tempo = readTempo(first, `sections.${present[0]}`, fail);
  for (const name of present) {
    const s = source.sections[name];
    const base = `sections.${name}`;
    for (const [field, ok] of [
      ["keys", (e) => e?.tonic === first.keys?.[0]?.tonic && e?.scale === first.keys?.[0]?.scale],
      ["meters", (e) => e?.numBeats === first.meters?.[0]?.numBeats && e?.beatUnit === first.meters?.[0]?.beatUnit],
      ["tempos", (e) => e?.bpm === first.tempos?.[0]?.bpm],
    ]) {
      if (!Array.isArray(s[field]) || s[field].length === 0) fail(`${base}.${field}`, `${field.slice(0, -1)} is missing`);
      else s[field].forEach((e, i) => ok(e) || fail(`${base}.${field}[${i}]`, "key, meter or tempo change is not supported"));
    }
  }
  if (errors.length || !key || !meter || !tempo) return { ok: false, errors };

  const barTicks = meter.numBeats * PPQ;
  const rh = [];
  const chordsOut = [];
  const bass = [];
  const sections = [];
  const summary = {};
  let cursor = 0;

  for (const name of present) {
    const s = source.sections[name];
    const base = `sections.${name}`;
    if (!isNum(s.endBeat) || s.endBeat <= 1) {
      fail(`${base}.endBeat`, "endBeat must be a number greater than 1");
      continue;
    }
    const start = cursor;
    const end = start + Math.round((s.endBeat - 1) * PPQ);
    const notes = Array.isArray(s.notes) ? s.notes : [];
    const chords = Array.isArray(s.chords) ? s.chords : [];
    if (!Array.isArray(s.notes)) fail(`${base}.notes`, "notes must be an array");
    if (!Array.isArray(s.chords)) fail(`${base}.chords`, "chords must be an array");
    summary[name] = { notes: notes.length, pitched: 0, chords: chords.length };

    notes.forEach((n, i) => {
      const path = `${base}.notes[${i}]`;
      if (!isObj(n)) return fail(path, "note must be an object");
      if (n.isRest === true) return;
      const m = typeof n.sd === "string" ? SD_RE.exec(n.sd) : null;
      if (!m) return fail(`${path}.sd`, "degree must be 1 to 7 with an optional b or # prefix");
      if (!Number.isInteger(n.octave)) return fail(`${path}.octave`, "octave offset must be an integer");
      if (!isNum(n.beat) || n.beat < 1) return fail(`${path}.beat`, "beat must be a number from 1");
      if (!isNum(n.duration) || n.duration <= 0) return fail(`${path}.duration`, "duration must be a positive number");
      const pitch = spellDegree(key, Number(m[2]), ALTER[m[1] ?? ""], n.octave);
      if (!pitch || !inPianoRange(parsePitch(pitch).midi)) return fail(`${path}.sd`, `note ${i} is outside A0 to C8`);
      const tick = start + Math.round((n.beat - 1) * PPQ);
      if (tick >= end) return fail(`${path}.beat`, "note starts after the end of its section");
      summary[name].pitched += 1;
      rh.push({ tick, dur: Math.max(1, Math.round(n.duration * PPQ)), pitch, hand: "R", role: "melody", voice: 1, path, end });
    });

    const derived = [];
    chords.forEach((c, i) => {
      const path = `${base}.chords[${i}]`;
      if (!isObj(c)) return fail(path, "chord must be an object");
      if (c.isRest === true) return;
      if (!isNum(c.beat) || c.beat < 1) return fail(`${path}.beat`, "beat must be a number from 1");
      if (!isNum(c.duration) || c.duration <= 0) return fail(`${path}.duration`, "duration must be a positive number");
      const d = deriveChord(c, key, path);
      if (!d.ok) return errors.push(...d.errors);
      const tick = start + Math.round((c.beat - 1) * PPQ);
      if (tick >= end) return fail(`${path}.beat`, "chord starts after the end of its section");
      derived.push({ tick, dur: Math.max(1, Math.round(c.duration * PPQ)), ...d, path, end });
    });
    // A chord lasts until its own end, cut at the next chord and at the section end; its bass note lasts as long.
    derived.forEach((c, i) => {
      const next = derived[i + 1];
      const dur = clip({ ...c, end: next && next.tick > c.tick ? Math.min(c.end, next.tick) : c.end }, "chord", warnings);
      chordsOut.push({ tick: c.tick, dur, symbol: c.symbol, roman: c.roman });
      bass.push({ tick: c.tick, dur, pitch: `${c.rootName}2`, hand: "L", role: "bass", voice: 1 });
    });

    sections.push({ id: name, name: capitalize(name), startTick: start, endTick: end });
    cursor = end;
  }
  if (errors.length) return { ok: false, errors };

  // Right hand: clip to the section end, then to the next onset (the melody is one voice).
  rh.sort((a, b) => a.tick - b.tick);
  const melody = rh.map((n, i) => {
    const next = rh.slice(i + 1).find((o) => o.tick > n.tick);
    return { tick: n.tick, dur: clip({ ...n, end: next ? Math.min(n.end, next.tick) : n.end }, "note", warnings), pitch: n.pitch, hand: n.hand, role: n.role, voice: n.voice };
  });

  const lastEnd = Math.max(cursor, ...melody.map((n) => n.tick + n.dur));
  const lengthTicks = Math.ceil(lastEnd / barTicks) * barTicks;

  const url = typeof sourceUrl === "string" && sourceUrl !== "" ? sourceUrl : source.source;
  if (!validUrl(url)) fail("source", "missing source URL: pass sourceUrl or include `source` in the capture");
  const when = typeof source.accessed === "string" ? source.accessed : accessed;
  if (typeof when !== "string" || !ISO_DATE.test(when)) fail("accessed", "the access date must be an ISO date (YYYY-MM-DD)");
  if (errors.length) return { ok: false, errors };

  const chordSymbols = [...new Set(chordsOut.map((c) => c.symbol))];
  const confidence = [];
  for (const name of present) {
    if (summary[name].pitched > 0) confidence.push({ scope: `notes:${name}`, level: "medium", note: "Single user-submitted capture; verify by ear." });
    if (summary[name].chords > 0) confidence.push({ scope: `chords:${name}`, level: "medium", note: "Single user-submitted capture; verify by ear." });
  }
  const level = {
    label: { en: "Beginner", es: "Principiante" },
    description: { en: "Melody in the right hand, chord roots in the left hand.", es: "Melodía en la mano derecha, notas fundamentales de los acordes en la izquierda." },
    notation: "labelled",
    notes: [...melody, ...bass].sort((a, b) => a.tick - b.tick || b.hand.localeCompare(a.hand)),
  };
  if (Math.abs(keyFifths(key)) >= 3) level.learn = { transposeTo: ["C"] };

  const song = {
    schemaVersion: 1,
    id,
    title,
    composer,
    visibility: "private",
    key: { tonic: key.tonic, mode: "major" },
    meter: { num: meter.numBeats, den: 4 },
    pickupTicks: 0,
    tempo: { bpm: tempo.bpm, beatUnit: "quarter" },
    lengthTicks,
    sections,
    chords: chordsOut,
    levels: { beginner: level },
    defaultLevel: "beginner",
    lesson: {
      beginner: {
        summary: LESSON.summary,
        posture: LESSON.posture,
        chordsUsed: chordSymbols,
        handPositions: [],
        practicePlan: ["Check the notes by ear before relying on them.", "Learn one phrase at a time, right hand first."],
      },
    },
    sources: [{ url, what: "Melody and chords converted from a user-submitted capture (scale degrees, beats and octaves).", accessed: when, kind: "user-submitted" }],
    confidence,
  };

  const checked = validateSong(song);
  if (!checked.ok) return { ok: false, errors: checked.errors.map((e) => ({ path: e.path, message: `${e.rule}: ${e.message}` })) };
  return { ok: true, song, warnings, summary };
}

// The duration up to `item.end`, with a warning naming the position when it had to be cut.
function clip(item, label, warnings) {
  const room = item.end - item.tick;
  if (item.dur <= room) return item.dur;
  warnings.push(`${item.path}: ${label} clipped from ${item.dur} to ${room} ticks`);
  return Math.max(1, room);
}

const validUrl = (u) => {
  try {
    return typeof u === "string" && Boolean(new URL(u));
  } catch {
    return false;
  }
};

function readKey(section, base, fail) {
  const k = section.keys?.[0];
  if (!k) return fail(`${base}.keys`, "key is missing");
  if (k.scale !== "major") return fail(`${base}.keys[0].scale`, "only major keys are supported");
  if (typeof k.tonic !== "string" || !parsePitch(`${k.tonic}4`)) return fail(`${base}.keys[0].tonic`, "tonic must be a spelled note name such as E or Bb");
  return { tonic: k.tonic, mode: "major" };
}

function readMeter(section, base, fail) {
  const m = section.meters?.[0];
  if (!m) return fail(`${base}.meters`, "meter is missing");
  if (m.beatUnit !== 1) return fail(`${base}.meters[0].beatUnit`, "only a quarter-note beat unit (1) is supported");
  if (!Number.isInteger(m.numBeats) || m.numBeats < 1) return fail(`${base}.meters[0].numBeats`, "numBeats must be a positive integer");
  return { numBeats: m.numBeats };
}

function readTempo(section, base, fail) {
  const t = section.tempos?.[0];
  if (!t) return fail(`${base}.tempos`, "tempo is missing");
  if (!isNum(t.bpm) || t.bpm < 20 || t.bpm > 300) return fail(`${base}.tempos[0].bpm`, "tempo bpm must be a number from 20 to 300");
  return { bpm: t.bpm };
}
