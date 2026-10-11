import { test } from "node:test";
import assert from "node:assert/strict";
import { createScore, quantizeToBeat, countNodes, mountedWindow, scoreText, MOUNT_RADIUS } from "../../src/score/render.js";
import { layoutScore } from "../../src/score/layout.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { beatGrid } from "../../src/core/timing.js";
import { fakeDoc, fakeSlot, all } from "./fake-dom.js";

const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };
const R = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "R", ...extra });
const L = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "L", ...extra });

function timelineOf(notes, { notation = "labelled", meter = M44, tempo = { bpm: 72, beatUnit: "quarter" }, pickupTicks = 0, lengthTicks = 3840 } = {}) {
  const song = { key: { tonic: "E", mode: "major" }, meter, pickupTicks, lengthTicks, tempo, levels: { x: { label: "Beginner", notation, strictBars: true, notes } } };
  return resolveLevel(song, "x");
}
function mount(tl, size = [1000, 330], opts = {}) {
  const doc = fakeDoc();
  const slot = fakeSlot(doc, ...size);
  const score = createScore(slot, { timeline: tl, title: "Cancer", doc, ...opts });
  return { doc, slot, score, svg: () => slot.children[0], scroll: () => all(slot, (n) => n.tag === "g" && n.attrs.transform)[0] };
}
const bars = (slot) => all(slot, (n) => n.attrs["data-bar"] !== undefined).map((n) => Number(n.attrs["data-bar"]));

test("quantizeToBeat gives the start of the current beat and matches the metronome grid", () => {
  const tl = timelineOf([R(0, 1920, "E4")]);
  assert.equal(quantizeToBeat(0, tl), 0);
  assert.equal(quantizeToBeat(479, tl), 0);
  assert.equal(quantizeToBeat(480, tl), 480);
  assert.equal(quantizeToBeat(1000, tl), 960);
  const grid = beatGrid(M44, 0, "quarter", 0, 3840).map((b) => b.tick);
  for (const t of [0, 1, 479, 480, 1500, 2399, 3839]) assert.equal(quantizeToBeat(t, tl), Math.max(...grid.filter((g) => g <= t)), `tick ${t}`);
});

test("quantizeToBeat follows the beat unit: a dotted quarter in 12/8 and the pickup offset", () => {
  const tl = timelineOf([R(0, 2880, "E4")], { meter: M128, tempo: { bpm: 60, beatUnit: "dotted-quarter" }, lengthTicks: 2880 });
  assert.deepEqual([0, 719, 720, 1500, 2879].map((t) => quantizeToBeat(t, tl)), [0, 0, 720, 1440, 2160]);
  const pick = timelineOf([R(0, 480, "E4")], { pickupTicks: 480, lengthTicks: 2400 });
  assert.equal(quantizeToBeat(600, pick), 480, "counted from the pickup end");
});

test("countNodes counts children and mountedWindow clamps both ends", () => {
  assert.equal(countNodes([{ children: [{}, { children: [{}] }] }, {}]), 5);
  assert.deepEqual(mountedWindow(0, 100), [0, MOUNT_RADIUS]);
  assert.deepEqual(mountedWindow(50, 100), [42, 58]);
  assert.deepEqual(mountedWindow(99, 100), [91, 99]);
  assert.deepEqual(mountedWindow(1, 3), [0, 2]);
});

test("the SVG has role img with a title naming the song and level and a description", () => {
  const { svg } = mount(timelineOf([R(0, 1920, "E4")], { lengthTicks: 1920 }));
  assert.equal(svg().attrs.role, "img");
  assert.equal(svg().children[0].tag, "title");
  assert.equal(svg().children[0].textContent, "Cancer, Beginner score");
  assert.equal(svg().children[1].tag, "desc");
  assert.equal(svg().children[1].textContent, "E major, 4/4, 72 quarter beats per minute, 1 bar.");
  assert.ok(scoreText("X", timelineOf([R(0, 480, "E4")], { pickupTicks: 480, lengthTicks: 2400 })).desc.endsWith("after a pickup."));
});

test("setTimeline updates the title and description for the new level", () => {
  const { svg, score } = mount(timelineOf([R(0, 1920, "E4")], { lengthTicks: 1920 }));
  score.setTimeline({ ...timelineOf([R(0, 1920, "E4")], { notation: "engraved", lengthTicks: 1920 }), label: "Original" }, { title: "Cancer" });
  assert.equal(svg().children[0].textContent, "Cancer, Original score");
  assert.equal(svg().attrs.class, "score-svg score-engraved");
});

test("render scrolls the content left by the distance between ticks, and a seek back returns to the same place", () => {
  const tl = timelineOf([R(0, 1920, "E4"), R(1920, 1920, "G4")]);
  const { scroll, score } = mount(tl);
  const layout = layoutScore(tl);
  score.render(0);
  const at0 = scroll().translate[0];
  score.render(1920);
  const at1920 = scroll().translate[0];
  assert.ok(Math.abs(at0 - at1920 - layout.tickToX(1920) * 11) < 0.01, "moved by tickToX(1920) pixels");
  score.render(960);
  assert.ok(at1920 < scroll().translate[0] && scroll().translate[0] < at0, "mid tick is between");
  score.render(0);
  assert.equal(scroll().translate[0], at0, "a seek or a loop wrap is a pure function of the tick");
});

test("reduced motion steps the score per beat; normal motion moves inside the beat (counter-proof)", () => {
  const tl = timelineOf([R(0, 1920, "E4")], { lengthTicks: 1920 });
  const { scroll, score } = mount(tl);
  score.render(500);
  const smooth = scroll().translate[0];
  score.render(900);
  assert.notEqual(scroll().translate[0], smooth, "normal motion: different positions inside one beat");
  score.setReducedMotion(true);
  score.render(500);
  const a = scroll().translate[0];
  score.render(900);
  assert.equal(scroll().translate[0], a, "reduced motion: the same beat, the same place");
  score.render(960);
  assert.notEqual(scroll().translate[0], a, "the next beat steps");
  score.setReducedMotion(false);
  score.render(900);
  assert.notEqual(scroll().translate[0], a, "clearing the preference resumes smooth movement");
});

test("a hidden hand is not drawn and showing it again redraws it", () => {
  const { slot, score } = mount(timelineOf([R(0, 1920, "E4"), L(0, 1920, "E2")], { lengthTicks: 1920 }));
  const heads = (hand) => all(slot, (n) => n.attrs.class?.includes(`head-${hand}`)).length;
  assert.deepEqual([heads("R"), heads("L")], [1, 1]);
  score.setHandModes({ L: { hidden: true }, R: { hidden: false } });
  assert.deepEqual([heads("R"), heads("L")], [1, 0]);
  score.setHandModes({ L: { hidden: false }, R: { hidden: false } });
  assert.deepEqual([heads("R"), heads("L")], [1, 1]);
});

test("the names toggle redraws immediately: Mi, then E, and Original shows neither", () => {
  const { slot, score } = mount(timelineOf([R(0, 1920, "E4")], { lengthTicks: 1920 }));
  const names = () => all(slot, (n) => n.attrs.class === "note-name").map((n) => n.textContent);
  assert.deepEqual(names(), ["Mi"]);
  score.setMode({ names: "letters" });
  assert.deepEqual(names(), ["E"]);
  score.setTimeline(timelineOf([R(0, 1920, "E4")], { notation: "engraved", lengthTicks: 1920 }));
  assert.deepEqual(names(), []);
});

test("beyond the node limit only the measures near the playhead stay mounted; a small score mounts all", () => {
  const notes = [];
  for (let b = 0; b < 400; b += 1) for (let q = 0; q < 4; q += 1) notes.push(R(b * 1920 + q * 480, 480, "E4"), L(b * 1920 + q * 480, 480, "E2"));
  const { slot, score } = mount(timelineOf(notes, { lengthTicks: 400 * 1920 }));
  const span = () => [Math.min(...bars(slot)), Math.max(...bars(slot))];
  score.render(0);
  assert.deepEqual(span(), [1, 1 + MOUNT_RADIUS]);
  score.render(200 * 1920 + 10);
  assert.deepEqual(span(), [201 - MOUNT_RADIUS, 201 + MOUNT_RADIUS]);
  assert.equal(bars(slot).length, 2 * MOUNT_RADIUS + 1);
  score.render(0);
  assert.equal(bars(slot).length, MOUNT_RADIUS + 1, "seeking back unmounts the far measures");
  const small = mount(timelineOf([R(0, 1920, "E4"), R(1920, 1920, "G4")]));
  assert.equal(bars(small.slot).length, 2, "counter-proof: below the limit every measure is mounted");
});

test("song text only ever reaches the DOM through textContent", () => {
  const { slot } = mount(timelineOf([R(0, 1920, "E4", { label: "<img src=x onerror=alert(1)>" })], { lengthTicks: 1920 }), [1000, 330], { title: "<b>Song</b>" });
  const labelled = all(slot, (n) => n.attrs.class === "note-name")[0];
  assert.equal(labelled.textContent, "<img src=x onerror=alert(1)>");
  assert.equal(all(slot, (n) => n.tag === "title")[0].textContent, "<b>Song</b>, Beginner score");
  assert.equal(all(slot, (n) => "innerHTML" in n).length, 0, "no element was given innerHTML");
});

test("the unit shrinks to fit a short slot, and resize rebuilds only when the size changed", () => {
  const tl = timelineOf([R(0, 1920, "E4")], { lengthTicks: 1920 });
  const tall = mount(tl, [1000, 400]);
  const short = mount(tl, [1000, 168]);
  const h = (m) => Number(m.svg().attrs.viewBox.split(" ")[3]);
  assert.ok(h(short) <= 168 && h(tall) > h(short));
  const first = short.svg();
  short.score.resize();
  assert.equal(short.svg(), first, "same size, same SVG");
  short.slot.clientWidth = 600;
  short.score.resize();
  assert.notEqual(short.svg(), first, "a new size rebuilds");
  assert.equal(short.svg().attrs.viewBox.split(" ")[2], "600");
});

test("dispose removes the SVG", () => {
  const { slot, score } = mount(timelineOf([R(0, 1920, "E4")], { lengthTicks: 1920 }));
  score.dispose();
  assert.equal(slot.children.length, 0);
});
