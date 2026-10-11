import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES, GROUPS, missingCardFields } from "../../src/practice/catalog.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { INTERVALS } from "../../src/theory/intervals.js";
import { TRIAD_QUALITIES } from "../../src/theory/triads.js";
import { createI18n } from "../../src/i18n/i18n.js";

test("every exercise has all five card fields in English and in Spanish", () => {
  assert.deepEqual(missingCardFields(EXERCISES, STRINGS), []);
});

test("counter-proof: a fixture exercise without what good looks like is flagged, naming the exercise and the field", () => {
  const fixture = [{ id: "fixture" }];
  const table = { "ex.fixture.title": { en: "T", es: "T" }, "ex.fixture.goal": { en: "G", es: "G" }, "ex.fixture.why": { en: "W", es: "W" }, "ex.fixture.how": { en: "H", es: "H" } };
  assert.deepEqual(missingCardFields(fixture, table), ["ex.fixture.good (en)", "ex.fixture.good (es)"]);
  assert.deepEqual(missingCardFields(fixture, { ...table, "ex.fixture.good": { en: "ok", es: "  " } }), ["ex.fixture.good (es)"], "a blank Spanish text counts as missing");
  assert.deepEqual(missingCardFields(fixture, { ...table, "ex.fixture.good": { en: "ok", es: "bien" } }), []);
});

test("deleting a real card field from a copy of the table is caught", () => {
  const broken = { ...STRINGS };
  delete broken["ex.scale-major.good"];
  assert.deepEqual(missingCardFields(EXERCISES, broken), ["ex.scale-major.good (en)", "ex.scale-major.good (es)"]);
});

test("every group, interval and chord quality has its name and its plain line in both languages", () => {
  for (const g of GROUPS) for (const k of [`practice.group.${g}`, `practice.groupHint.${g}`]) assert.ok(STRINGS[k]?.en && STRINGS[k]?.es, k);
  for (const { id } of INTERVALS) for (const k of [`interval.${id}`, `interval.${id}.hint`]) assert.ok(STRINGS[k]?.en && STRINGS[k]?.es, k);
  for (const q of TRIAD_QUALITIES) for (const k of [`quality.${q}`, `quality.${q}.hint`]) assert.ok(STRINGS[k]?.en && STRINGS[k]?.es, k);
  assert.deepEqual(STRINGS["practice.notFound"], { en: "Exercise not found", es: "Ejercicio no encontrado" });
});

test("the card text is short: a title fits one line and no field is a paragraph of more than 45 words", () => {
  for (const e of EXERCISES) {
    for (const lang of ["en", "es"]) {
      assert.ok(STRINGS[`ex.${e.id}.title`][lang].length <= 40, `${e.id} title (${lang})`);
      for (const f of ["goal", "why", "how", "good"]) {
        const words = STRINGS[`ex.${e.id}.${f}`][lang].split(/\s+/).length;
        assert.ok(words <= 45, `${e.id}.${f} (${lang}) has ${words} words`);
      }
    }
  }
});

test("the card renders in Spanish when Spanish is selected: no field falls back to English", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "es", warn: () => assert.fail("missing") });
  assert.equal(i18n.lang(), "es");
  for (const e of EXERCISES) for (const f of ["title", "goal", "why", "how", "good"]) {
    const es = i18n.t(`ex.${e.id}.${f}`);
    assert.equal(es, STRINGS[`ex.${e.id}.${f}`].es);
    assert.notEqual(es, STRINGS[`ex.${e.id}.${f}`].en, `${e.id}.${f} is not just the English text`);
  }
});

test("the interval buttons read as names a beginner can use, each with its size in semitones in the plain line", () => {
  for (const { id, semitones } of INTERVALS) {
    for (const lang of ["en", "es"]) assert.ok(STRINGS[`interval.${id}.hint`][lang].includes(`(${semitones} semiton`), `${id} ${lang}`);
  }
});
