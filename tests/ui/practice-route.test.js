import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { validSong } from "../fixtures/helpers.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { createRouter, parseHash } from "../../src/ui/router.js";
import { createStore } from "../../src/ui/state.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { renderCatalog } = await import("../../src/ui/catalog.js");

const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const main = readFileSync(new URL("../../src/main.js", import.meta.url), "utf8");

function harness(views) {
  const listeners = new Set();
  const win = { location: { hash: "" }, addEventListener: (t, f) => t === "hashchange" && listeners.add(f), removeEventListener: (t, f) => t === "hashchange" && listeners.delete(f) };
  const mount = { replaceChildren() {} };
  const router = createRouter({ mount, views, store: createStore({ route: null }), win });
  return { router, go: (h) => { win.location.hash = h; for (const f of [...listeners]) f(); } };
}

test("the practice routes reach the practice view: the list with no id, a card with the raw id, and Learn is disposed first", () => {
  const log = [];
  const view = (name) => (route) => (log.push(`mount ${name}:${route.songId ?? "-"}`), { dispose: () => log.push(`dispose ${name}`) });
  const h = harness({ catalog: view("catalog"), learn: view("learn"), practice: view("practice"), unknown: view("unknown") });
  h.router.start();
  h.go("#/learn/ode-to-joy");
  log.length = 0;
  h.go("#/practice");
  h.go("#/practice/scale-major");
  h.go("#/practice/<b>");
  assert.deepEqual(log, ["dispose learn", "mount practice:-", "dispose practice", "mount practice:scale-major", "dispose practice", "mount practice:<b>"]);
  assert.equal(parseHash("#/practice/scale-major").songId, "scale-major");
});

test("main.js mounts Practice lazily, so the catalog does not download it, and puts a Practice link in the header", () => {
  assert.match(main, /practice: lazyView\(\(\) => import\("\.\/ui\/practice-view\.js"\)/);
  assert.equal(/^import .*practice-view/m.test(main), false, "no static import of the practice view");
  assert.match(main, /href: "#\/practice"/);
  assert.match(main, /i18n\.t\("common\.practice"\)/);
  assert.match(main, /i18n\.onChange\(\(\) => \(practiceLink\.textContent = i18n\.t\("common\.practice"\)\)\)/, "the link follows the language");
});

test("the catalog hero has a Practice exercises button beside the start button, in both languages", () => {
  const entry = { id: "example-song", file: "example-song.json", title: "Example Song", composer: "Traditional", key: { tonic: "C", mode: "major" }, defaultBpm: 72, levels: ["beginner"] };
  for (const [lang, label] of [["en", "Practice exercises"], ["es", "Ejercicios de práctica"]]) {
    const mount = doc.make("div");
    renderCatalog(mount, { error: null, entries: [{ entry, status: "ok", song: validSong() }] }, createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} }));
    const links = all(mount, (n) => n.tag === "a" && n.attrs.href === "#/practice");
    assert.equal(links.length, 1, lang);
    assert.equal(textOf(links[0]), label);
    assert.equal(all(mount, (n) => n.tag === "a" && /^#\/learn\//.test(n.attrs.href ?? "")).length >= 1, true, "the start button is still there");
  }
});

test("counter-proof: a catalog with no usable song still offers Practice, and the link is not on the song cards", () => {
  const mount = doc.make("div");
  renderCatalog(mount, { error: null, entries: [{ entry: { id: "x", file: "x.json", title: "X", composer: "Y", key: { tonic: "C", mode: "major" }, defaultBpm: 60, levels: ["beginner"] }, status: "unavailable", reason: "broken" }] }, createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => {} }));
  assert.equal(all(mount, (n) => n.tag === "a" && n.attrs.href === "#/practice").length, 1);
});
