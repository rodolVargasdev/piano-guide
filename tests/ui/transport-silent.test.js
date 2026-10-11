import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createTransport, playLabel } = await import("../../src/ui/transport.js");

const timeline = { lengthTicks: 3840, sections: [] };
function fakeEngine({ silent = false, playReports = { silent } } = {}) {
  const calls = [];
  return {
    calls,
    isSilent: () => silent,
    play: () => (calls.push("play"), playReports),
    pause() {},
    stop() {},
    seek() {},
    getBpm: () => 72,
    setBpm: (n) => n,
    setSlow() {},
    setMetronome() {},
    on: () => () => {},
  };
}
const i18nFor = (lang = "en") => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
const buttons = (root) => all(root, (n) => n.tag === "button");
const playButton = (transport) => buttons(transport.element)[0];

test("playLabel: Play for a public song, Play (no sound) for a silent one, in both languages", () => {
  const en = i18nFor("en");
  const es = i18nFor("es");
  assert.equal(playLabel({ silent: false, t: en.t }), "Play");
  assert.equal(playLabel({ silent: true, t: en.t }), "Play (no sound)");
  assert.equal(playLabel({ silent: true, t: es.t }), "Reproducir (sin sonido)");
  assert.equal(playLabel({ silent: false, t: es.t }), "Reproducir");
});

test("the play button of a silent song says there is no sound before it is pressed", () => {
  const transport = createTransport({ engine: fakeEngine({ silent: true }), timeline, i18n: i18nFor() });
  assert.equal(playButton(transport)._text, "Play (no sound)");
});

test("counter-proof: the play button of a public song stays Play, before and after pressing it", () => {
  const engine = fakeEngine({ silent: false });
  const transport = createTransport({ engine, timeline, i18n: i18nFor() });
  assert.equal(playButton(transport)._text, "Play");
  playButton(transport).click();
  assert.deepEqual(engine.calls, ["play"]);
  assert.equal(playButton(transport)._text, "Play");
});

test("a play() that reports silent relabels the button even if the engine said nothing before", () => {
  const engine = { ...fakeEngine({ silent: false, playReports: { silent: true } }), isSilent: undefined };
  const transport = createTransport({ engine, timeline, i18n: i18nFor() });
  assert.equal(playButton(transport)._text, "Play");
  playButton(transport).click();
  assert.equal(playButton(transport)._text, "Play (no sound)");
});

test("the label follows the language at once, and a disposed transport stops following", () => {
  const i18n = i18nFor("en");
  const transport = createTransport({ engine: fakeEngine({ silent: true }), timeline, i18n });
  i18n.setLang("es");
  assert.equal(playButton(transport)._text, "Reproducir (sin sonido)");
  transport.dispose();
  i18n.setLang("en");
  assert.equal(playButton(transport)._text, "Reproducir (sin sonido)");
});
