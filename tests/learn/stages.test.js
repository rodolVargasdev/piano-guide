import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePhrases } from "../../src/learn/phrases.js";
import { buildPlan, findStage, handsIn, stageBpm } from "../../src/learn/stages.js";
import { BAR, Q, learnSong, line, note } from "../fixtures/learn-songs.js";

const brief = (plan) => plan.map((u) => `${u.scope}:${u.phraseIndex}:${u.hand}:${u.tempo}`);
const planOf = (notes, { bars = 2, sections, learn } = {}) => {
  const { song, timeline } = learnSong({ notes, bars, learn });
  const tl = sections ? { ...timeline, sections } : timeline;
  const phrases = derivePhrases(tl);
  return { plan: buildPlan(tl, phrases), phrases, timeline: tl, song };
};
const TWO_PHRASES = { phrases: [{ id: "a", startTick: 0, endTick: BAR }, { id: "b", startTick: BAR, endTick: 2 * BAR }] };
const both = (startTick) => [...line(["C4", "D4", "E4"], { startTick }), note(startTick, 2 * Q, "C3", "L")];

test("a two-hand phrase has four stages: right slow, left slow, together slow, together full", () => {
  const { plan } = planOf(both(0), { bars: 1 });
  assert.deepEqual(brief(plan), ["phrase:0:R:slow", "phrase:0:L:slow", "phrase:0:T:slow", "phrase:0:T:full"]);
  assert.deepEqual(plan.map((u) => [u.startTick, u.endTick]), Array(4).fill([0, BAR]));
});

test("two phrases with both hands: the four stages of each phrase in order, then one whole-song stage at full tempo", () => {
  const { plan } = planOf([...both(0), ...both(BAR)], { learn: TWO_PHRASES });
  assert.deepEqual(brief(plan), [
    "phrase:0:R:slow", "phrase:0:L:slow", "phrase:0:T:slow", "phrase:0:T:full",
    "phrase:1:R:slow", "phrase:1:L:slow", "phrase:1:T:slow", "phrase:1:T:full",
    "song:0:T:full",
  ]);
  const last = plan.at(-1);
  assert.deepEqual([last.startTick, last.endTick], [0, 2 * BAR]);
});

test("a one-hand song has one stage per phrase (together would equal that hand) and a whole-song stage for that hand", () => {
  const right = planOf([...line(["C4", "D4"]), ...line(["E4", "F4"], { startTick: BAR })], { learn: TWO_PHRASES }).plan;
  assert.deepEqual(brief(right), ["phrase:0:R:slow", "phrase:1:R:slow", "song:0:R:full"]);
  const left = planOf([note(0, Q, "C3", "L"), note(BAR, Q, "G2", "L")], { learn: TWO_PHRASES }).plan;
  assert.deepEqual(brief(left), ["phrase:0:L:slow", "phrase:1:L:slow", "song:0:L:full"], "a left-hand-only song never gets a right-hand stage");
});

test("a hand with no notes in a phrase drops its stages there only", () => {
  const { plan } = planOf([...both(0), ...line(["E4", "F4"], { startTick: BAR })], { learn: TWO_PHRASES });
  assert.deepEqual(brief(plan), ["phrase:0:R:slow", "phrase:0:L:slow", "phrase:0:T:slow", "phrase:0:T:full", "phrase:1:R:slow", "song:0:T:full"]);
  assert.ok(!plan.some((u) => u.phraseIndex === 1 && u.hand === "L"), "no left-hand stage in the phrase without left-hand notes");
});

test("a single phrase has no whole-song stage, and a phrase without any note has no stage", () => {
  assert.deepEqual(brief(planOf(line(["C4", "D4"]), { bars: 1 }).plan), ["phrase:0:R:slow"]);
  const { plan } = planOf(line(["C4", "D4"]), { learn: TWO_PHRASES });
  assert.deepEqual(brief(plan), ["phrase:0:R:slow"], "the empty second phrase has nothing to practice and one phrase needs no song stage");
});

test("sections: a section with more than one phrase gets its own stage before the whole song; one section alone gets none", () => {
  const four = { phrases: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, startTick: i * BAR, endTick: (i + 1) * BAR })) };
  const notes = [0, 1, 2, 3].flatMap((i) => line(["C4", "D4"], { startTick: i * BAR }));
  const sections = [{ id: "verse", name: "Verse", startTick: 0, endTick: 2 * BAR }, { id: "chorus", name: "Chorus", startTick: 2 * BAR, endTick: 4 * BAR }];
  const { plan } = planOf(notes, { bars: 4, learn: four, sections });
  assert.deepEqual(brief(plan).slice(4), ["section:0:R:full", "section:2:R:full", "song:0:R:full"]);
  assert.deepEqual(plan.filter((u) => u.scope === "section").map((u) => u.id), ["section:verse", "section:chorus"]);
  // Counter-proof: with a single section there is no section stage (it would equal the song stage).
  const single = planOf(notes, { bars: 4, learn: four });
  assert.ok(!brief(single.plan).some((b) => b.startsWith("section")));
  // And a section holding one phrase has none either.
  const uneven = [{ id: "a", name: "A", startTick: 0, endTick: BAR }, { id: "b", name: "B", startTick: BAR, endTick: 4 * BAR }];
  assert.deepEqual(planOf(notes, { bars: 4, learn: four, sections: uneven }).plan.filter((u) => u.scope === "section").map((u) => u.id), ["section:b"]);
});

test("the section and song stages play both hands when both play inside them", () => {
  const sections = [{ id: "a", name: "A", startTick: 0, endTick: BAR }, { id: "b", name: "B", startTick: BAR, endTick: 3 * BAR }];
  const notes = [...line(["C4"], { startTick: 0 }), ...both(BAR), ...line(["D4"], { startTick: 2 * BAR })];
  const learn = { phrases: [0, 1, 2].map((i) => ({ id: `p${i}`, startTick: i * BAR, endTick: (i + 1) * BAR })) };
  const { plan } = planOf(notes, { bars: 3, learn, sections });
  assert.deepEqual(plan.filter((u) => u.scope !== "phrase").map((u) => [u.id, u.hand, u.tempo]), [["section:b", "T", "full"], ["song", "T", "full"]]);
});

test("handsIn lists the hands with a pitched onset in the range, ignoring rests", () => {
  const { timeline } = planOf([...line(["C4"]), note(0, Q, "C3", "L")], { bars: 1 });
  assert.deepEqual(handsIn(timeline, 0, BAR), ["R", "L"]);
  assert.deepEqual(handsIn(timeline, Q, BAR), []);
});

test("stage tempo: slow is the slow-mode half of the song tempo, full is the song tempo, both inside the BPM limits", () => {
  const tl = (bpm) => ({ tempo: { bpm } });
  assert.equal(stageBpm(tl(100), { tempo: "slow" }), 50);
  assert.equal(stageBpm(tl(100), { tempo: "full" }), 100);
  assert.equal(stageBpm(tl(44), { tempo: "slow" }), 22);
  assert.equal(stageBpm(tl(30), { tempo: "slow" }), 20, "never below the minimum BPM");
  assert.equal(stageBpm(tl(300), { tempo: "full" }), 240, "never above the maximum BPM");
});

test("findStage locates the first slow phrase stage of a hand at or after a phrase", () => {
  const { plan } = planOf([...both(0), ...line(["E4"], { startTick: BAR })], { learn: TWO_PHRASES });
  assert.equal(findStage(plan, { hand: "R" }), 0);
  assert.equal(findStage(plan, { hand: "L" }), 1);
  assert.equal(findStage(plan, { hand: "R", fromPhrase: 1 }), 4);
  assert.equal(findStage(plan, { hand: "L", fromPhrase: 1 }), -1, "no left-hand phrase left");
  assert.equal(findStage(plan, { hand: "R", scope: "song" }), -1, "slow phrase stages only unless another scope has a slow stage");
});
