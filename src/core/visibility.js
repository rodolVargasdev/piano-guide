// Pure song visibility. A song is "public" unless its file says "private".
// The silent rule is derived from visibility and never stored: a private song is silent.

/** "public" (the default when the field is absent) or "private". */
export function visibilityOf(song) {
  return song?.visibility === "private" ? "private" : "public";
}

/** True when the song must never be scheduled by the audio engine (see core/timeline `silent`). */
export function isSilent(song) {
  return visibilityOf(song) === "private";
}
