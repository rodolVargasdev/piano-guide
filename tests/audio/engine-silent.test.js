import { test } from "node:test";
import assert from "node:assert/strict";
import { rig } from "./engine-rig.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { validateSong } from "../../src/core/schema.js";
import { mutated } from "../fixtures/helpers.js";

// The fixture song is 3840 ticks at 72 BPM (576 ticks per second), about 6.7 s.
const withTwoLevels = (s) => void (s.levels.original = structuredClone(s.levels.beginner));
const publicSong = () => mutated(withTwoLevels);
const privateSong = () => mutated((s) => void (withTwoLevels(s), (s.visibility = "private")));
const timelineOf = (song, level = "beginner") => resolveLevel(song, level);

test("the private fixture is a valid song, so the tests below use a realistic input", () => {
  assert.equal(validateSong(privateSong()).ok, true);
});

test("a private song never schedules a note, play() says it is silent, and the clock still runs to the end", () => {
  const { engine, notes, run } = rig({ timeline: timelineOf(privateSong()) });
  let ended = 0;
  engine.on("ended", () => (ended += 1));
  assert.equal(engine.isSilent(), true);
  assert.deepEqual(engine.play(), { silent: true });
  run(1);
  assert.ok(engine.position().tick > 0, "the position advances so views can animate");
  run(8);
  assert.equal(notes.length, 0);
  assert.equal(ended, 1, "the transport reaches the end of the song");
});

test("counter-proof: the same song as a public one schedules its notes and play() says it is not silent", () => {
  const { engine, notes, run } = rig({ timeline: timelineOf(publicSong()) });
  assert.equal(engine.isSilent(), false);
  assert.deepEqual(engine.play(), { silent: false });
  run(8);
  assert.equal(notes.length, 8, "all eight events of the fixture sound");
});

test("a private song stays silent through a loop and through seek-and-play", () => {
  const looped = rig({ timeline: timelineOf(privateSong()) });
  looped.engine.setLoop({ startTick: 0, endTick: 1920 });
  looped.engine.play();
  looped.run(12);
  assert.equal(looped.notes.length, 0);
  assert.ok(looped.engine.isPlaying());
  assert.ok(looped.engine.position().tick < 1920, "the cursor stays inside the loop");

  const seeked = rig({ timeline: timelineOf(privateSong()) });
  seeked.engine.seek(1920);
  seeked.engine.play();
  seeked.run(5);
  assert.equal(seeked.notes.length, 0);
});

test("every level of a private song is silent", () => {
  for (const level of ["beginner", "original"]) {
    const { engine, notes, run } = rig({ timeline: timelineOf(privateSong(), level) });
    engine.play();
    run(8);
    assert.equal(notes.length, 0, level);
  }
});

test("changing hand modes or reloading the timeline while a private song plays still schedules nothing", () => {
  const { engine, notes, run } = rig({ timeline: timelineOf(privateSong()) });
  engine.seek(480);
  engine.play();
  run(0.5);
  engine.setHandModes({ L: { muted: true } });
  engine.setHandModes({ L: { muted: false } });
  engine.setTimeline(timelineOf(privateSong(), "original"), { tick: 480 }); // catch-up path (sustain)
  run(2);
  assert.equal(notes.length, 0);
});

test("the metronome is not song data: it still clicks while a private song plays", () => {
  const { engine, notes, clicks, run } = rig({ timeline: timelineOf(privateSong()) });
  engine.setMetronome({ enabled: true });
  engine.play();
  run(2);
  assert.equal(notes.length, 0);
  assert.ok(clicks.length > 0);
});

test("fail closed: a hand-built timeline with notes and no silent field schedules nothing", () => {
  const handBuilt = { ...timelineOf(publicSong()) };
  delete handBuilt.silent;
  const { engine, notes, run } = rig({ timeline: handBuilt });
  assert.equal(engine.isSilent(), true);
  assert.deepEqual(engine.play(), { silent: true });
  run(8);
  assert.equal(notes.length, 0);
});

test("counter-proof: forging silent: false on a private timeline is the only thing that opens the gate", () => {
  const forged = { ...timelineOf(privateSong()), silent: false };
  const { engine, notes, run } = rig({ timeline: forged });
  engine.play();
  run(8);
  assert.equal(notes.length, 8, "the engine trusts the stamped field, which only resolveLevel writes");
});

test("loading a public timeline after a private one makes the engine audible again", () => {
  const { engine, notes, run } = rig({ timeline: timelineOf(privateSong()) });
  engine.setTimeline(timelineOf(publicSong()));
  assert.equal(engine.isSilent(), false);
  engine.play();
  run(8);
  assert.equal(notes.length, 8);
});
