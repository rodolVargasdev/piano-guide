// Pure song and index validators. No DOM, no dependencies.
//
// Result shape: { ok, errors: [{ path, message, rule }], warnings: [{ path, message, rule }] }.
// `rule` names the rule that produced the finding (R1 to R11 for songs, I1 and I2 for the
// index, W1 to W3 for warnings). `options.disabledRules` silences a rule: it exists so the
// test suite can prove, for each rule, that its malformed case only fails because of that
// rule (the counter-proof of every guard).

import { parsePitch, inPianoRange, keyFifths } from "./pitch.js";
import { ticksPerBar } from "./timing.js";

const BEAT_UNITS = ["quarter", "eighth", "dotted-quarter", "half"];
const LEVEL_IDS = ["beginner", "original"];
const NOTATIONS = ["labelled", "engraved"];
const SOURCE_KINDS = ["public-domain-score", "user-submitted", "original-arrangement", "reference"];
const CONFIDENCE_LEVELS = ["high", "medium", "low"];
const ROLES = ["melody", "accompaniment", "bass", "ornament"];
const ORNAMENTS = ["turn", "trill", "mordent", "inverted-mordent", "fioritura"];
const FINGERING_SOURCES = ["source", "editorial"];
const ANALYSIS_KINDS = ["harmony", "voice-leading", "ornament", "rubato", "dynamics", "form"];
const PUBLIC_DOMAIN_HOSTS = ["mutopiaproject.org", "imslp.org"];

// Durations the score can draw: whole to 32nd, plain or dotted (PPQ 480: whole = 1920).
const NOTATABLE = new Set([1920, 960, 480, 240, 120, 60].flatMap((d) => [d, d * 1.5]).filter(Number.isInteger));

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isInt = (v) => Number.isInteger(v);
const isIsoDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function collector(options = {}) {
  const disabled = new Set(options.disabledRules ?? []);
  const errors = [];
  const warnings = [];
  return {
    err: (rule, path, message) => void (disabled.has(rule) || errors.push({ path, message, rule })),
    warn: (rule, path, message) => void (disabled.has(rule) || warnings.push({ path, message, rule })),
    result: () => ({ ok: errors.length === 0, errors, warnings }),
  };
}

function hostAccepted(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return PUBLIC_DOMAIN_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

// Recursive scan: every `lyrics` key holding any non-empty text is reported.
function hasText(v) {
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(hasText);
  return isObj(v) && Object.values(v).some(hasText);
}
function scanLyrics(node, path, onFound) {
  if (Array.isArray(node)) node.forEach((v, i) => scanLyrics(v, `${path}[${i}]`, onFound));
  else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === "lyrics" && hasText(v)) onFound(`${path}.${k}`);
      else scanLyrics(v, `${path}.${k}`, onFound);
    }
  }
}

function checkKey(c, key, path) {
  if (!isObj(key)) return c.err("R1", path, "key must be an object { tonic, mode }");
  if (!parsePitch(`${key.tonic}4`)) c.err("R1", `${path}.tonic`, "tonic must be a spelled note name such as Eb or F#");
  if (key.mode !== "major" && key.mode !== "minor") c.err("R1", `${path}.mode`, 'mode must be "major" or "minor"');
}

function checkHeader(c, song) {
  for (const f of ["id", "title", "composer"]) {
    if (!(f in song)) c.err("R1", f, "required field is missing");
    else if (!isStr(song[f])) c.err("R1", f, "must be a non-empty string");
  }
  if (isStr(song.id) && !/^[a-z0-9-]+$/.test(song.id)) c.err("R1", "id", "id must match ^[a-z0-9-]+$");
  if (!("schemaVersion" in song)) c.err("R1", "schemaVersion", "required field is missing");
  else if (song.schemaVersion !== 1) c.err("R1", "schemaVersion", "schemaVersion must be 1");
  if (!("key" in song)) c.err("R1", "key", "required field is missing");
  else checkKey(c, song.key, "key");
  if ("contentPolicy" in song && !["open", "chords-only"].includes(song.contentPolicy)) {
    c.err("R1", "contentPolicy", 'contentPolicy must be "open" or "chords-only"');
  }
  const k = song.key && keyFifths(song.key);
  if (k !== null && k !== undefined && Math.abs(k) > 4) c.warn("W2", "key", "key signature has more than 4 accidentals");
}

// Returns { meter, barLen, pickup, length } with null where invalid, so later rules can skip safely.
function checkTiming(c, song) {
  const out = { meter: null, barLen: null, pickup: null, length: null };
  if (!("meter" in song)) c.err("R1", "meter", "required field is missing");
  else if (!isObj(song.meter) || !isInt(song.meter.num) || song.meter.num < 1 || ![2, 4, 8].includes(song.meter.den)) {
    c.err("R1", "meter", "meter must be { num >= 1, den in 2, 4, 8 }");
  } else {
    out.meter = song.meter;
    out.barLen = ticksPerBar(song.meter);
  }
  if (!("pickupTicks" in song)) c.err("R1", "pickupTicks", "required field is missing");
  else if (!isInt(song.pickupTicks) || song.pickupTicks < 0 || (out.barLen !== null && song.pickupTicks >= out.barLen)) {
    c.err("R1", "pickupTicks", "pickupTicks must be an integer from 0 to less than one bar");
  } else out.pickup = song.pickupTicks;

  if (!("tempo" in song)) c.err("R1", "tempo", "required field is missing");
  else if (!isObj(song.tempo)) c.err("R1", "tempo", "tempo must be an object { bpm, beatUnit }");
  else {
    const { bpm, beatUnit, marking } = song.tempo;
    if (typeof bpm !== "number" || !(bpm >= 20 && bpm <= 300)) c.err("R1", "tempo.bpm", "bpm must be a number from 20 to 300");
    if (!BEAT_UNITS.includes(beatUnit)) c.err("R1", "tempo.beatUnit", `beatUnit must be one of ${BEAT_UNITS.join(", ")}`);
    if (marking !== undefined && typeof marking !== "string") c.err("R1", "tempo.marking", "marking must be a string");
  }

  if (!("lengthTicks" in song)) c.err("R1", "lengthTicks", "required field is missing");
  else if (!isInt(song.lengthTicks) || song.lengthTicks <= 0) c.err("R1", "lengthTicks", "lengthTicks must be a positive integer");
  else {
    out.length = song.lengthTicks;
    if (out.barLen !== null && out.pickup !== null && (song.lengthTicks - out.pickup) % out.barLen !== 0) {
      c.err("R1", "lengthTicks", "lengthTicks must be pickupTicks plus a whole number of bars");
    }
  }
  return out;
}

function checkSources(c, song) {
  if (!("sources" in song) || !Array.isArray(song.sources)) return c.err("R1", "sources", "required array is missing");
  if (song.sources.length === 0) c.err("R3", "sources", "sources must not be empty");
  song.sources.forEach((s, i) => {
    const p = `sources[${i}]`;
    if (!isObj(s)) return c.err("R3", p, "source must be an object");
    let urlOk = false;
    try {
      urlOk = isStr(s.url) && Boolean(new URL(s.url));
    } catch {
      urlOk = false;
    }
    if (!urlOk) c.err("R3", `${p}.url`, "url is required and must be a valid URL");
    if (!isStr(s.what)) c.err("R3", `${p}.what`, "what is required");
    if (!isIsoDate(s.accessed)) c.err("R3", `${p}.accessed`, "accessed must be an ISO date (YYYY-MM-DD)");
    if (!SOURCE_KINDS.includes(s.kind)) c.err("R3", `${p}.kind`, `kind must be one of ${SOURCE_KINDS.join(", ")}`);
  });
}

function checkConfidence(c, song) {
  if (!Array.isArray(song.confidence)) return c.err("R1", "confidence", "required array is missing");
  if (song.confidence.length === 0) c.err("R4", "confidence", "confidence must not be empty");
  song.confidence.forEach((e, i) => {
    const p = `confidence[${i}]`;
    if (!isObj(e)) return c.err("R4", p, "confidence entry must be an object");
    if (!isStr(e.scope)) c.err("R4", `${p}.scope`, "scope is required");
    if (!CONFIDENCE_LEVELS.includes(e.level)) c.err("R4", `${p}.level`, "level must be high, medium or low");
    if (!isStr(e.note)) c.err("R4", `${p}.note`, "note is required");
  });
}

function checkSpans(c, list, path, length, fields, label) {
  // R11: chords and sections stay inside the song and keep their order.
  let prev = null;
  list.forEach((item, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(item)) return c.err("R11", p, `${label} must be an object`);
    const start = item[fields.start];
    const end = fields.end ? item[fields.end] : item[fields.start] + item.dur;
    if (!isInt(start) || start < 0) return c.err("R11", `${p}.${fields.start}`, `${fields.start} must be a non-negative integer`);
    if (!fields.end && (!isInt(item.dur) || item.dur <= 0)) return c.err("R11", `${p}.dur`, "dur must be a positive integer");
    if (fields.end && (!isInt(end) || end <= start)) return c.err("R11", `${p}.${fields.end}`, `${fields.end} must be greater than ${fields.start}`);
    if (length !== null && end > length) c.err("R11", p, `${label} ends after lengthTicks`);
    if (prev) {
      if (start < prev.start) c.err("R11", p, `${path} must be sorted by ${fields.start}`);
      else if (fields.end && start < prev.end) c.err("R11", p, `${label} overlaps the previous one`);
    }
    prev = { start, end };
  });
}

function checkChordList(c, list, path, length) {
  if (!Array.isArray(list)) return c.err("R1", path, "must be an array");
  checkSpans(c, list, path, length, { start: "tick" }, "chord");
  list.forEach((ch, i) => {
    if (isObj(ch) && !isStr(ch.symbol)) c.err("R1", `${path}[${i}].symbol`, "symbol is required");
  });
}

function checkEvent(c, n, path, length) {
  if (!isObj(n)) return c.err("R7", path, "event must be an object");
  const rest = n.rest === true;
  if (!isInt(n.tick) || n.tick < 0) c.err("R8", `${path}.tick`, "tick must be a non-negative integer");
  if (!isInt(n.dur) || n.dur <= 0) c.err("R8", `${path}.dur`, "dur must be a positive integer");
  else if (isInt(n.tick) && length !== null && n.tick + n.dur > length) c.err("R8", path, "event ends after lengthTicks");
  if (n.hand !== "L" && n.hand !== "R") c.err("R7", `${path}.hand`, 'hand must be "L" or "R"');
  if (n.voice !== undefined && n.voice !== 1 && n.voice !== 2) c.err("R7", `${path}.voice`, "voice must be 1 or 2");
  if (!rest) {
    const p = parsePitch(n.pitch);
    if (n.pitch === undefined) c.err("R7", `${path}.pitch`, "a non-rest event needs a pitch");
    else if (!p) c.err("R7", `${path}.pitch`, "pitch is not a spelled pitch such as Eb4");
    else if (!inPianoRange(p.midi)) c.err("R7", `${path}.pitch`, "pitch is outside A0 to C8");
  }
  if (n.finger !== undefined && !(isInt(n.finger) && n.finger >= 1 && n.finger <= 5)) c.err("R7", `${path}.finger`, "finger must be an integer from 1 to 5");
  if (n.vel !== undefined && !(typeof n.vel === "number" && n.vel >= 0 && n.vel <= 1)) c.err("R7", `${path}.vel`, "vel must be a number from 0 to 1");
  if (n.role !== undefined && !ROLES.includes(n.role)) c.err("R7", `${path}.role`, `role must be one of ${ROLES.join(", ")}`);
  if (n.ornament !== undefined && !ORNAMENTS.includes(n.ornament)) c.err("R7", `${path}.ornament`, `ornament must be one of ${ORNAMENTS.join(", ")}`);
  if (n.fingeringSource !== undefined && !FINGERING_SOURCES.includes(n.fingeringSource)) c.err("R7", `${path}.fingeringSource`, "fingeringSource must be source or editorial");
  if (n.tuplet !== undefined && !(isObj(n.tuplet) && isInt(n.tuplet.n) && isInt(n.tuplet.inSpaceOf) && n.tuplet.n > 0 && n.tuplet.inSpaceOf > 0)) {
    c.err("R7", `${path}.tuplet`, "tuplet must be { n, inSpaceOf } with positive integers");
  }
  if (isInt(n.dur) && n.dur > 0) {
    const nominal = n.tuplet && isInt(n.tuplet.n) && isInt(n.tuplet.inSpaceOf) ? (n.dur * n.tuplet.n) / n.tuplet.inSpaceOf : n.dur;
    if (!NOTATABLE.has(nominal)) c.warn("W1", `${path}.dur`, `duration ${n.dur} is outside the notation subset (whole to 32nd, plain or dotted)`);
  }
}

// R9: non-grace events of one hand and voice must not overlap, except identical tick and dur (a chord).
function checkOverlaps(c, group, levelPath) {
  const sorted = [...group].sort((a, b) => a.n.tick - b.n.tick || a.n.dur - b.n.dur);
  let cur = null;
  for (const { n, i } of sorted) {
    const rest = n.rest === true;
    if (cur && n.tick === cur.tick && n.dur === cur.dur && rest === cur.rest) continue;
    if (cur && n.tick < cur.tick + cur.dur) {
      c.err("R9", `${levelPath}.notes[${i}]`, `event overlaps the previous event in hand ${n.hand}, voice ${n.voice ?? 1}`);
    }
    cur = { tick: n.tick, dur: n.dur, rest };
  }
}

// R10: with strictBars, every bar of each used hand and voice is exactly covered and no event crosses a barline.
function checkStrictBars(c, group, levelPath, timing, hand, voice) {
  const { barLen, pickup, length } = timing;
  const barOf = (t) => (t < pickup ? 0 : Math.floor((t - pickup) / barLen) + 1);
  const buckets = new Map();
  for (const { n, i } of group) {
    if (barOf(n.tick) !== barOf(n.tick + n.dur - 1)) {
      c.err("R10", `${levelPath}.notes[${i}]`, "event crosses a barline; split it into tied events");
      continue;
    }
    const b = barOf(n.tick);
    if (!buckets.has(b)) buckets.set(b, new Map());
    buckets.get(b).set(`${n.tick}:${n.dur}:${n.rest === true}`, n.dur);
  }
  const lastBar = (length - pickup) / barLen;
  for (let b = pickup > 0 ? 0 : 1; b <= lastBar; b += 1) {
    const expected = b === 0 ? pickup : barLen;
    const covered = [...(buckets.get(b) ?? new Map()).values()].reduce((a, d) => a + d, 0);
    if (covered !== expected) c.err("R10", `${levelPath}.notes`, `bar ${b}, hand ${hand}, voice ${voice}: covers ${covered} of ${expected} ticks`);
  }
}

function checkLevel(c, id, level, timing, song) {
  const path = `levels.${id}`;
  if (!isObj(level)) return c.err("R1", path, "level must be an object");
  for (const f of ["label", "description"]) if (!isStr(level[f])) c.err("R1", `${path}.${f}`, "required string is missing");
  if (!NOTATIONS.includes(level.notation)) c.err("R1", `${path}.notation`, 'notation must be "labelled" or "engraved"');
  if (!Array.isArray(level.notes)) return c.err("R1", `${path}.notes`, "required array is missing");
  if (level.chords !== undefined) checkChordList(c, level.chords, `${path}.chords`, timing.length);

  level.notes.forEach((n, i) => checkEvent(c, n, `${path}.notes[${i}]`, timing.length));
  const groups = new Map();
  level.notes.forEach((n, i) => {
    if (!isObj(n) || n.grace === true || !isInt(n.tick) || !isInt(n.dur) || n.dur <= 0 || n.tick < 0) return;
    if (n.hand !== "L" && n.hand !== "R") return;
    const key = `${n.hand}${n.voice ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ n, i });
  });
  const canCheckBars = timing.barLen !== null && timing.pickup !== null && timing.length !== null && (timing.length - timing.pickup) % timing.barLen === 0;
  for (const [key, group] of groups) {
    checkOverlaps(c, group, path);
    if (level.strictBars === true && canCheckBars) checkStrictBars(c, group, path, timing, key[0], key[1]);
  }

  if (Array.isArray(level.pedal)) {
    level.pedal.forEach((p, i) => {
      if (!isObj(p) || !isInt(p.startTick) || !isInt(p.endTick) || p.startTick < 0 || p.endTick <= p.startTick || (timing.length !== null && p.endTick > timing.length)) {
        c.err("R11", `${path}.pedal[${i}]`, "pedal range must be integers inside the song with endTick > startTick");
      }
    });
  }
  if (Array.isArray(level.analysis)) {
    level.analysis.forEach((a, i) => {
      const p = `${path}.analysis[${i}]`;
      const inside = (t) => isInt(t) && t >= 0 && (timing.length === null || t <= timing.length);
      if (!isObj(a) || !inside(a.tick) || (a.endTick !== undefined && (!inside(a.endTick) || a.endTick < a.tick))) {
        c.err("R11", p, "analysis ticks must be integers inside the song");
      } else if (!ANALYSIS_KINDS.includes(a.kind) || !isStr(a.title) || !isStr(a.text)) {
        c.err("R1", p, `analysis needs title, text and a kind of ${ANALYSIS_KINDS.join(", ")}`);
      }
    });
  }

  if (song.contentPolicy === "chords-only") {
    level.notes.forEach((n, i) => {
      if (isObj(n) && n.role === "melody") c.err("R6", `${path}.notes[${i}].role`, 'role "melody" is not allowed under contentPolicy "chords-only"');
    });
  }
}

function checkLesson(c, song, levelIds) {
  if (!("lesson" in song)) return c.err("R1", "lesson", "required field is missing");
  if (!isObj(song.lesson)) return c.err("R1", "lesson", "lesson must be an object keyed by level id");
  for (const [id, l] of Object.entries(song.lesson)) {
    const p = `lesson.${id}`;
    if (!levelIds.includes(id)) c.warn("W3", p, "lesson entry for a level that does not exist");
    if (!isObj(l)) c.err("R1", p, "lesson entry must be an object");
    else {
      if (!isStr(l.summary)) c.err("R1", `${p}.summary`, "summary is required");
      if (!isStr(l.posture)) c.err("R1", `${p}.posture`, "posture is required");
      if (!Array.isArray(l.chordsUsed)) c.err("R1", `${p}.chordsUsed`, "chordsUsed must be an array");
      if (!Array.isArray(l.handPositions)) c.err("R1", `${p}.handPositions`, "handPositions must be an array");
      if (!Array.isArray(l.practicePlan)) c.err("R1", `${p}.practicePlan`, "practicePlan must be an array");
      if (l.ornaments !== undefined) {
        if (!Array.isArray(l.ornaments)) c.err("R1", `${p}.ornaments`, "ornaments must be an array");
        else {
          l.ornaments.forEach((o, i) => {
            if (!isObj(o) || !isInt(o.tick) || o.tick < 0 || !isStr(o.name) || !isStr(o.text)) c.err("R1", `${p}.ornaments[${i}]`, "ornament needs an integer tick, a name and a text");
          });
        }
      }
    }
  }
  for (const id of levelIds) if (!(id in song.lesson)) c.warn("W3", `lesson.${id}`, "level has no lesson");
}

export function validateSong(json, options = {}) {
  const c = collector(options);
  if (!isObj(json)) {
    c.err("R1", "", "song must be a JSON object");
    return c.result();
  }
  checkHeader(c, json);
  const timing = checkTiming(c, json);
  checkSources(c, json);
  checkConfidence(c, json);

  if (!Array.isArray(json.sections)) c.err("R1", "sections", "required array is missing");
  else {
    checkSpans(c, json.sections, "sections", timing.length, { start: "startTick", end: "endTick" }, "section");
    json.sections.forEach((s, i) => {
      if (isObj(s) && (!isStr(s.id) || !isStr(s.name))) c.err("R1", `sections[${i}]`, "section needs id and name");
    });
  }
  if (!("chords" in json)) c.err("R1", "chords", "required field is missing");
  else checkChordList(c, json.chords, "chords", timing.length);

  let levelIds = [];
  if (!isObj(json.levels)) c.err("R1", "levels", "required object is missing");
  else {
    levelIds = Object.keys(json.levels);
    if (levelIds.length === 0) c.err("R2", "levels", "at least one level is required");
    for (const id of levelIds) {
      if (!LEVEL_IDS.includes(id)) c.err("R2", `levels.${id}`, `unknown level id; expected ${LEVEL_IDS.join(" or ")}`);
      checkLevel(c, id, json.levels[id], timing, json);
    }
  }
  if (!isStr(json.defaultLevel)) c.err("R1", "defaultLevel", "required string is missing");
  else if (!levelIds.includes(json.defaultLevel)) c.err("R2", "defaultLevel", "defaultLevel is not a key of levels");
  checkLesson(c, json, levelIds);

  // R5: transcribed notes need a public-domain score source on an accepted host.
  const accepted = Array.isArray(json.sources) && json.sources.some((s) => isObj(s) && s.kind === "public-domain-score" && hostAccepted(s.url));
  for (const id of levelIds) {
    if (isObj(json.levels[id]) && json.levels[id].transcribed === true && !accepted) {
      c.err("R5", `levels.${id}.transcribed`, "transcribed level needs a public-domain-score source on mutopiaproject.org or imslp.org");
    }
  }
  // R6: no lyrics text anywhere under chords-only.
  if (json.contentPolicy === "chords-only") {
    scanLyrics(json, "", (p) => c.err("R6", p.replace(/^\./, ""), "lyrics are not allowed under contentPolicy \"chords-only\""));
  }
  return c.result();
}

export function validateIndex(json, options = {}) {
  const c = collector(options);
  if (!isObj(json) || !Array.isArray(json.songs)) {
    c.err("I1", "songs", "index must be { songs: [...] }");
    return c.result();
  }
  const seen = new Set();
  json.songs.forEach((e, i) => {
    const p = `songs[${i}]`;
    if (!isObj(e)) return c.err("I1", p, "entry must be an object");
    for (const f of ["id", "file", "title", "composer", "key", "defaultBpm", "levels"]) {
      if (!(f in e)) c.err("I1", `${p}.${f}`, "required field is missing");
    }
    if ("file" in e && !(typeof e.file === "string" && /^[a-z0-9-]+\.json$/.test(e.file))) c.err("I1", `${p}.file`, "file must be <id>.json with no path");
    if (isStr(e.id) && typeof e.file === "string" && e.file !== `${e.id}.json`) c.err("I1", `${p}.file`, "file must be the id plus .json");
    if ("key" in e) checkKey(c, e.key, `${p}.key`);
    if ("defaultBpm" in e && !(typeof e.defaultBpm === "number" && e.defaultBpm >= 20 && e.defaultBpm <= 300)) c.err("I1", `${p}.defaultBpm`, "defaultBpm must be a number from 20 to 300");
    if ("levels" in e && !(Array.isArray(e.levels) && e.levels.length > 0 && e.levels.every((l) => LEVEL_IDS.includes(l)))) {
      c.err("I1", `${p}.levels`, "levels must list beginner and/or original");
    }
    if (typeof e.id === "string") {
      if (seen.has(e.id)) c.err("I2", `${p}.id`, `duplicate id "${e.id}"`);
      seen.add(e.id);
    }
  });
  return c.result();
}
