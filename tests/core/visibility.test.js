import { test } from "node:test";
import assert from "node:assert/strict";
import { visibilityOf, isSilent } from "../../src/core/visibility.js";
import { isLocalizedText, textOf } from "../../src/core/text.js";
import { validateSong } from "../../src/core/schema.js";
import { mutated, validSong } from "../fixtures/helpers.js";

test("a song with no visibility field is public and not silent", () => {
  const song = validSong();
  assert.equal("visibility" in song, false);
  assert.equal(visibilityOf(song), "public");
  assert.equal(isSilent(song), false);
  assert.equal(validateSong(song).ok, true);
});

test("a private song is silent, and only a private song is", () => {
  const song = mutated((s) => void (s.visibility = "private"));
  assert.equal(visibilityOf(song), "private");
  assert.equal(isSilent(song), true);
  assert.equal(isSilent({ visibility: "public" }), false);
  assert.equal(validateSong(song).ok, true);
});

test("the silent rule is derived: there is no stored silent field to forge", () => {
  const song = mutated((s) => void ((s.visibility = "private"), (s.silent = false)));
  assert.equal(isSilent(song), true, "a stray silent: false never un-silences a private song");
});

test("isLocalizedText needs both languages non-empty", () => {
  assert.equal(isLocalizedText({ en: "Hello", es: "Hola" }), true);
  assert.equal(isLocalizedText({ en: "Hello" }), false);
  assert.equal(isLocalizedText({ en: "Hello", es: "  " }), false);
  assert.equal(isLocalizedText("Hello"), false);
  assert.equal(isLocalizedText(null), false);
  assert.equal(isLocalizedText(["a", "b"]), false);
});

test("textOf returns a plain string for any language", () => {
  assert.equal(textOf("Plain", "en"), "Plain");
  assert.equal(textOf("Plain", "es"), "Plain");
});

test("textOf picks the requested language of a LocalizedText", () => {
  const t = { en: "Hello", es: "Hola" };
  assert.equal(textOf(t, "en"), "Hello");
  assert.equal(textOf(t, "es"), "Hola");
});

test("textOf falls back to English when the language is missing, and never to a raw object", () => {
  assert.equal(textOf({ en: "Hello" }, "es"), "Hello");
  assert.equal(textOf({ en: "Hello", es: "" }, "es"), "Hello");
  assert.equal(textOf({ es: "Hola" }, "fr"), "");
  assert.equal(textOf(undefined, "en"), "");
});
