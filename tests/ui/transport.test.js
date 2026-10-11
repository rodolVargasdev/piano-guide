import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, formatReadout, parseBpmField, sectionMarks, handsMessage, slowNote } from "../../src/ui/transport.js";

test("formatTime shows whole seconds as m:ss and survives bad input", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(7.9), "0:07");
  assert.equal(formatTime(61), "1:01");
  assert.equal(formatTime(600), "10:00");
  assert.equal(formatTime(-3), "0:00");
  assert.equal(formatTime(NaN), "0:00");
});

test("formatReadout names the bar, beat and time; the pickup reads Pickup", () => {
  assert.equal(formatReadout({ bar: 2, beat: 3, seconds: 7.4 }), "Bar 2, beat 3, 0:07");
  assert.equal(formatReadout({ bar: 0, beat: 4, seconds: 0 }), "Pickup, beat 4, 0:00");
});

test("parseBpmField clamps typed values: 500 gives 240, 5 gives 20", () => {
  assert.equal(parseBpmField("500", 72), 240);
  assert.equal(parseBpmField("5", 72), 20);
  assert.equal(parseBpmField(" 90 ", 72), 90);
  assert.equal(parseBpmField("72.4", 50), 72);
});

test("parseBpmField keeps the previous value for empty or non-numeric text", () => {
  assert.equal(parseBpmField("", 72), 72);
  assert.equal(parseBpmField("   ", 72), 72);
  assert.equal(parseBpmField("abc", 72), 72);
  assert.equal(parseBpmField(null, 72), 72);
  assert.equal(parseBpmField("Infinity", 72), 72);
});

test("counter-proof: without the clamp the typed 500 would stay 500", () => {
  assert.notEqual(Number("500"), parseBpmField("500", 72));
});

test("sectionMarks lists one mark per section start, in order", () => {
  const marks = sectionMarks([{ name: "Intro", startTick: 0 }, { name: "Verse", startTick: 3840 }]);
  assert.deepEqual(marks, [{ tick: 0, label: "Intro" }, { tick: 3840, label: "Verse" }]);
  assert.deepEqual(sectionMarks(undefined), []);
});

test("handsMessage appears only when both hands are muted", () => {
  const m = (l, r) => ({ L: { muted: l }, R: { muted: r } });
  assert.equal(handsMessage(m(true, true)), "Both hands muted");
  assert.equal(handsMessage(m(true, false)), "");
  assert.equal(handsMessage(m(false, true)), "");
  assert.equal(handsMessage(m(false, false)), "");
  assert.equal(handsMessage(undefined), "");
});

test("slowNote shows the effective BPM only while slow mode is on", () => {
  assert.equal(slowNote(100, true), "Slow: 50 BPM");
  assert.equal(slowNote(75, true), "Slow: 37.5 BPM");
  assert.equal(slowNote(100, false), "");
});
