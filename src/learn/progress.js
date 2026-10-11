// Saved progress of the learner, in one `localStorage` value. Storage is injected (anything with
// getItem and setItem), a missing, corrupt or blocked store reads as empty, and a failed write is
// swallowed: the lesson always works for the session. Only ids, indexes, tonic names, hand letters,
// stage numbers and dates are stored, never a pitch. No DOM, no dependency.

export const PROGRESS_KEY = "piano-guide:learn:v1";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isIndex = (v) => Number.isInteger(v) && v >= 0;
const HANDS = ["R", "L", "T"];

/** A fresh, empty progress value. */
export function emptyProgress() {
  return { v: 1, lessonZero: null, songs: {}, transpose: {} };
}

/** One saved position when it is well formed, else null. */
function cleanPosition(p) {
  if (!isObj(p) || !isIndex(p.phrase) || typeof p.updated !== "string") return null;
  return { phrase: p.phrase, ...(isIndex(p.stage) ? { stage: p.stage } : {}), ...(HANDS.includes(p.hand) ? { hand: p.hand } : {}), updated: p.updated };
}

/** Keeps only well-formed entries of a parsed value, so a hand-edited store cannot break the lesson. */
function normalize(raw) {
  const out = emptyProgress();
  if (!isObj(raw) || raw.v !== 1) return out;
  if (raw.lessonZero === "done" || raw.lessonZero === "skipped") out.lessonZero = raw.lessonZero;
  if (isObj(raw.songs)) {
    for (const [songId, levels] of Object.entries(raw.songs)) {
      if (!isObj(levels)) continue;
      for (const [levelId, tonics] of Object.entries(levels)) {
        if (!isObj(tonics)) continue;
        for (const [tonic, pos] of Object.entries(tonics)) {
          const clean = cleanPosition(pos);
          if (clean) (((out.songs[songId] ??= {})[levelId] ??= {})[tonic] = clean);
        }
      }
    }
  }
  if (isObj(raw.transpose)) {
    for (const [songId, tonic] of Object.entries(raw.transpose)) {
      if (tonic === null || typeof tonic === "string") out.transpose[songId] = tonic;
    }
  }
  return out;
}

/** Reads the saved progress; anything unreadable gives an empty progress and no error. */
export function readProgress(storage) {
  try {
    const text = storage?.getItem(PROGRESS_KEY);
    return text ? normalize(JSON.parse(text)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/** Saves the progress; a blocked or full store is ignored. Returns true when the write went through. */
export function writeProgress(storage, progress) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** Removes the saved positions and the transposition choice of one song ("Reset progress"); lesson zero stays. */
export function clearSong(storage, songId) {
  const progress = readProgress(storage);
  delete progress.songs[songId];
  delete progress.transpose[songId];
  return writeProgress(storage, progress);
}

/** The saved position of a song, level and tonic, or null. */
export function positionOf(progress, songId, levelId, tonic) {
  return progress.songs[songId]?.[levelId]?.[tonic] ?? null;
}

/** A copy of the progress with the position of a song, level and tonic set (`date` is YYYY-MM-DD, injected). */
export function withPosition(progress, { songId, levelId, tonic, phrase, stage, hand, date }) {
  const entry = cleanPosition({ phrase, stage, hand, updated: date });
  if (!entry) return progress;
  const next = normalize(JSON.parse(JSON.stringify(progress)));
  ((next.songs[songId] ??= {})[levelId] ??= {})[tonic] = entry;
  return next;
}

/** A copy with the transposition choice of a song set (a tonic name, or null for the original key). */
export function withTranspose(progress, songId, tonic) {
  return { ...progress, transpose: { ...progress.transpose, [songId]: tonic ?? null } };
}

/** A copy with lesson zero marked "done" or "skipped" (once for the learner, not per song). */
export function withLessonZero(progress, value) {
  return value === "done" || value === "skipped" ? { ...progress, lessonZero: value } : progress;
}
