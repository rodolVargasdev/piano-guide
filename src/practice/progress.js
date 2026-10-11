// Saved practice progress, in one `localStorage` value. Storage is injected (anything with getItem and setItem), a
// missing, corrupt or blocked store reads as empty and a failed write is swallowed: exercises always work for the
// session. Only exercise ids, tonic names, counts, tempos and calendar dates are stored, never a pitch.
// Two streaks with two names (A5): `cleanStreak` per exercise and key (consecutive clean runs, reset by an unclean
// run) and `dayStreak` for the routine (consecutive calendar days with a routine that had at least one block done).
// Pure apart from the storage calls. No DOM, no dependency.

export const PRACTICE_KEY = "piano-guide:practice:v1";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0 && v < 1e6;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9-]{1,40}$/;
const KEY = /^(?:[A-G](?:#|b)?|-)$/;
const isDate = (v) => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** A fresh, empty progress value. */
export function emptyPracticeProgress() {
  return { v: 1, exercises: {}, routine: { lastDate: null, dayStreak: 0, lastWarmupKey: null, scaleLastPracticed: {} } };
}

function cleanEntry(e) {
  if (!isObj(e) || !isCount(e.cleanStreak) || !isCount(e.bestTempo) || !isCount(e.cleanRuns) || !isDate(e.lastPracticed)) return null;
  return { cleanStreak: e.cleanStreak, bestTempo: e.bestTempo, cleanRuns: e.cleanRuns, lastPracticed: e.lastPracticed };
}

/** Keeps only well-formed entries of a parsed value, so a hand-edited store cannot break the page. */
function normalize(raw) {
  const out = emptyPracticeProgress();
  if (!isObj(raw) || raw.v !== 1) return out;
  if (isObj(raw.exercises)) {
    for (const [id, keys] of Object.entries(raw.exercises)) {
      if (!ID.test(id) || !isObj(keys)) continue;
      for (const [key, entry] of Object.entries(keys)) {
        const clean = KEY.test(key) ? cleanEntry(entry) : null;
        if (clean) (out.exercises[id] ??= {})[key] = clean;
      }
    }
  }
  const r = raw.routine;
  if (isObj(r)) {
    if (isDate(r.lastDate)) out.routine.lastDate = r.lastDate;
    if (isCount(r.dayStreak)) out.routine.dayStreak = r.dayStreak;
    if (typeof r.lastWarmupKey === "string" && KEY.test(r.lastWarmupKey)) out.routine.lastWarmupKey = r.lastWarmupKey;
    if (isObj(r.scaleLastPracticed)) for (const [k, d] of Object.entries(r.scaleLastPracticed)) if (KEY.test(k) && isDate(d)) out.routine.scaleLastPracticed[k] = d;
  }
  return out;
}

/** Reads the saved progress; anything unreadable gives an empty progress and no error. */
export function readPracticeProgress(storage) {
  try {
    const text = storage?.getItem(PRACTICE_KEY);
    return text ? normalize(JSON.parse(text)) : emptyPracticeProgress();
  } catch {
    return emptyPracticeProgress();
  }
}

/** Saves the progress; a blocked or full store is ignored. Returns true when the write went through. */
export function writePracticeProgress(storage, progress) {
  try {
    storage.setItem(PRACTICE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** "Reset progress": removes the saved value (or empties it when the store cannot remove). True when it worked. */
export function clearPracticeProgress(storage) {
  try {
    if (typeof storage.removeItem === "function") storage.removeItem(PRACTICE_KEY);
    else storage.setItem(PRACTICE_KEY, JSON.stringify(emptyPracticeProgress()));
    return true;
  } catch {
    return false;
  }
}

// ---- calendar days (local days, as ISO text) ---------------------------------------------------------

/** Today as YYYY-MM-DD in the learner's local calendar (not UTC, so a late evening stays today). */
export function localIsoDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole days from `a` to `b` (positive when `b` is later); NaN when either is not a date. */
export function daysBetween(a, b) {
  if (!isDate(a) || !isDate(b)) return NaN;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// ---- recording ---------------------------------------------------------------------------------------

/** The saved numbers of one exercise and key, or null. */
export function entryOf(progress, exerciseId, key) {
  return progress.exercises[exerciseId]?.[key] ?? null;
}

/**
 * recordRun(progress, { exerciseId, key, bpm, clean, date }) -> a new progress. A clean run adds one to `cleanStreak`
 * and `cleanRuns` and raises `bestTempo` to `bpm` when it is higher; an unclean run sets the streak to 0 and leaves the
 * best tempo and the run count alone. Either way `lastPracticed` is the date. Unusable input returns the same progress.
 */
export function recordRun(progress, { exerciseId, key, bpm, clean, date }) {
  if (!ID.test(exerciseId ?? "") || !KEY.test(key ?? "") || !isDate(date) || !isCount(Math.round(Number(bpm)))) return progress;
  const before = entryOf(progress, exerciseId, key) ?? { cleanStreak: 0, bestTempo: 0, cleanRuns: 0, lastPracticed: date };
  const entry =
    clean === true
      ? { cleanStreak: before.cleanStreak + 1, bestTempo: Math.max(before.bestTempo, Math.round(Number(bpm))), cleanRuns: before.cleanRuns + 1, lastPracticed: date }
      : { ...before, cleanStreak: 0, lastPracticed: date };
  return { ...progress, exercises: { ...progress.exercises, [exerciseId]: { ...progress.exercises[exerciseId], [key]: entry } } };
}

/**
 * recordRoutine(progress, { date, blocks }) -> a new progress. `blocks` is [{ id, key, status }] with `id` "warmup",
 * "scale", "chords" or "ear" and `status` "done" or "skipped". When no block is done it is a no-op (the same progress
 * comes back): a routine that was skipped end to end records nothing and leaves the day streak alone. Otherwise the day
 * is recorded: `dayStreak` is one more when the last recorded day was yesterday, unchanged when it was today, else 1;
 * `lastWarmupKey` and `scaleLastPracticed` change only for blocks that were done.
 */
export function recordRoutine(progress, { date, blocks }) {
  const done = (blocks ?? []).filter((b) => b.status === "done");
  if (done.length === 0 || !isDate(date)) return progress;
  const { lastDate, dayStreak } = progress.routine;
  const gap = lastDate === null ? NaN : daysBetween(lastDate, date);
  const streak = gap === 0 ? Math.max(1, dayStreak) : gap === 1 ? dayStreak + 1 : 1;
  const routine = { ...progress.routine, lastDate: gap < 0 ? lastDate : date, dayStreak: gap < 0 ? dayStreak : streak, scaleLastPracticed: { ...progress.routine.scaleLastPracticed } };
  for (const b of done) {
    if (b.id === "warmup" && KEY.test(b.key ?? "")) routine.lastWarmupKey = b.key;
    if (b.id === "scale" && KEY.test(b.key ?? "")) routine.scaleLastPracticed[b.key] = date;
  }
  return { ...progress, routine };
}

/**
 * summaryOf(progress, exerciseId) -> { keys, cleanStreak, bestTempo, cleanRuns, lastPracticed } over every key of
 * the exercise: the longest current streak, the highest clean tempo, the total clean runs and the latest date
 * (null when nothing was practiced). `keys` is how many keys have a record.
 */
export function summaryOf(progress, exerciseId) {
  const entries = Object.values(progress.exercises[exerciseId] ?? {});
  return {
    keys: entries.length,
    cleanStreak: Math.max(0, ...entries.map((e) => e.cleanStreak)),
    bestTempo: Math.max(0, ...entries.map((e) => e.bestTempo)),
    cleanRuns: entries.reduce((sum, e) => sum + e.cleanRuns, 0),
    lastPracticed: entries.map((e) => e.lastPracticed).sort().at(-1) ?? null,
  };
}
