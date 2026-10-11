import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHash, isSongId } from "../../src/ui/router.js";

const DEFAULTS = { songId: null, level: null, names: "solfege", view: "both" };

test("the catalog is the route for empty, # and #/", () => {
  for (const h of ["", "#", "#/", undefined, null, 42]) {
    assert.deepEqual(parseHash(h), { route: "catalog", ...DEFAULTS }, String(h));
  }
});

test("#/song/<id> gives the song route with defaults", () => {
  assert.deepEqual(parseHash("#/song/cancer"), { route: "song", ...DEFAULTS, songId: "cancer" });
});

test("query parameters level, names and view are read", () => {
  assert.deepEqual(parseHash("#/song/chopin-nocturne-op9-no2?level=original&names=letters&view=score"), {
    route: "song",
    songId: "chopin-nocturne-op9-no2",
    level: "original",
    names: "letters",
    view: "score",
  });
});

test("invalid parameter values fall back to defaults", () => {
  const r = parseHash("#/song/cancer?level=Be%20Ginner&names=numbers&view=3d");
  assert.deepEqual(r, { route: "song", ...DEFAULTS, songId: "cancer" });
});

test("unknown routes and malformed song paths are unknown", () => {
  for (const h of ["#/nope", "#/song", "#/song/", "#/song/a/b", "#/songs/cancer", "#song/cancer"]) {
    assert.equal(parseHash(h).route, "unknown", h);
  }
});

test("hostile ids are returned as inert text, never as a valid id", () => {
  const raw = parseHash("#/song/<script>alert(1)</script>");
  assert.equal(raw.route, "unknown"); // the slash inside the closing tag splits the path
  const encoded = parseHash("#/song/%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  assert.equal(encoded.route, "song");
  assert.equal(encoded.songId, "<script>alert(1)</script>");
  assert.equal(isSongId(encoded.songId), false);
  assert.equal(isSongId("<script>"), false);
});

test("malformed percent-encoding does not throw", () => {
  const r = parseHash("#/song/%E0%A4%A");
  assert.equal(r.route, "song");
  assert.equal(r.songId, "%E0%A4%A");
});

test("counter-proof: well-formed ids are accepted by isSongId", () => {
  assert.equal(isSongId("cancer"), true);
  assert.equal(isSongId("chopin-nocturne-op9-no2"), true);
  assert.equal(isSongId(""), false);
  assert.equal(isSongId("Cancer"), false);
  assert.equal(isSongId(null), false);
});

test("a second question mark in the hash does not leak into the id", () => {
  const r = parseHash("#/song/cancer?level=beginner?x");
  assert.equal(r.songId, "cancer");
});
