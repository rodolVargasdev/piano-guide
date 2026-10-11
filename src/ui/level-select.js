// Level selection: which level opens, which levels the selector offers, where the musical
// position lands when the level changes, and how the choices live in the hash and in the
// session. The functions here are pure (storage is injected) and covered by node tests.

import { barBeatOf, tickOfBarBeat } from "../core/timing.js";

const ORDER = ["beginner", "original"];
const prefixKey = "piano-guide:level:";

/** The sessionStorage key that remembers the last level of a song. */
export const levelKey = (songId) => `${prefixKey}${songId}`;

const has = (song, id) => typeof id === "string" && Object.hasOwn(song.levels, id);

/**
 * Level to open: the hash `requested` level when the song has it, else the level remembered for
 * this session, else the song's default. Unknown ids (and inherited names such as "toString")
 * fall through to the next source.
 */
export function resolveLevelId(song, requested, remembered = null) {
  if (has(song, requested)) return requested;
  if (has(song, remembered)) return remembered;
  return song.defaultLevel;
}

/** The levels the selector lists: only those present, beginner first. `single` means a static chip. */
export function levelChoices(song) {
  const ids = Object.keys(song.levels).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  return { ids, single: ids.length === 1 };
}

/**
 * Tick in `to` that has the same bar and beat (and offset inside the beat) as `tick` has in
 * `from`, clamped to [0, to.lengthTicks]. A level switch keeps the musical position this way.
 */
export function mapPosition(tick, from, to) {
  const at = barBeatOf(tick, from.meter, from.pickupTicks, from.tempo.beatUnit);
  const mapped = tickOfBarBeat(at, to.meter, to.pickupTicks, to.tempo.beatUnit);
  return Math.max(0, Math.min(to.lengthTicks, mapped));
}

/**
 * A new hash with `changes` (any of level, names, view) written into the query and every other
 * parameter (such as debug=1) kept. Values are encoded by URLSearchParams.
 */
export function updateHash(hash, changes) {
  const [path, query = ""] = String(hash ?? "").replace(/^#/, "").split("?", 2);
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(changes)) params.set(k, v);
  const text = params.toString();
  return `#${path}${text ? `?${text}` : ""}`;
}

/** Reads the remembered level; any storage failure (blocked, full, private mode) reads as nothing. */
export function readRemembered(storage, songId) {
  try {
    return storage?.getItem(levelKey(songId)) ?? null;
  } catch {
    return null;
  }
}

/** Remembers the level for this session; returns false when storage refuses. */
export function remember(storage, songId, levelId) {
  try {
    storage.setItem(levelKey(songId), levelId);
    return true;
  } catch {
    return false;
  }
}
