import { readFileSync } from "node:fs";

const VALID_TEXT = readFileSync(new URL("./valid-song.json", import.meta.url), "utf8");

/** A fresh deep copy of the valid fixture. */
export function validSong() {
  return JSON.parse(VALID_TEXT);
}

/** A copy of the valid fixture with one mutation applied: the named malformed fixture of a test. */
export function mutated(mutate) {
  const song = validSong();
  mutate(song);
  return song;
}

/** Shorthand for the beginner level's notes of a song. */
export const notesOf = (song) => song.levels.beginner.notes;
