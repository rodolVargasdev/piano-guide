import { resolveLevel } from "../../src/core/timeline.js";
import { mutated } from "./helpers.js";

export const BAR = 1920; // one 4/4 bar in ticks
export const Q = 480; // one quarter note

/** [tick, dur, pitch, hand, extra?] as the note object of a song file. */
export const note = (tick, dur, pitch, hand = "R", extra = {}) => ({ tick, dur, pitch, hand, ...extra });
export const rest = (tick, dur, hand = "R") => ({ tick, dur, rest: true, hand });

/** A line of quarter notes from `startTick`, one per pitch. */
export const line = (pitches, { startTick = 0, hand = "R", dur = Q } = {}) => pitches.map((p, i) => note(startTick + i * dur, dur, p, hand));

/**
 * A valid synthetic public song of `bars` bars of 4/4 (plus `pickupTicks`) with the given notes, and its
 * resolved timeline. No melody of any real song: the fixtures are plain scales and arpeggios.
 */
export function learnSong({ notes, bars = 4, pickupTicks = 0, learn, key = { tonic: "C", mode: "major" } }) {
  const length = pickupTicks + bars * BAR;
  const song = mutated((s) => {
    s.key = key;
    s.pickupTicks = pickupTicks;
    s.lengthTicks = length;
    s.sections = [{ id: "a", name: "Verse", startTick: 0, endTick: length }];
    s.chords = [];
    s.levels.beginner.notes = notes;
    if (learn) s.levels.beginner.learn = learn;
  });
  return { song, timeline: resolveLevel(song, "beginner") };
}
