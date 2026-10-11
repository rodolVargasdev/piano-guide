import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createInputPanel, midiLine } = await import("../../src/ui/input-panel.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const i18nFor = (lang = "en") => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
function setup({ lang = "en", storage = memory(), connect } = {}) {
  const calls = { connect: 0 };
  const panel = createInputPanel({ i18n: i18nFor(lang), storage, connect: connect ?? (async () => void (calls.connect += 1)) });
  const q = (cls) => all(panel.element, (n) => (n.attrs.class ?? "").split(" ").includes(cls))[0];
  return { panel, storage, calls, q };
}

test("every MIDI state is one aligned line, in English and in Spanish", () => {
  const en = i18nFor("en");
  const es = i18nFor("es");
  const lines = {
    unsupported: ["MIDI: not available in this browser", "MIDI: no disponible en este navegador"],
    insecure: ["MIDI: needs a secure page", "MIDI: requiere una página segura"],
    idle: ["MIDI: not connected", "MIDI: sin conexión"],
    requesting: ["MIDI: waiting for permission", "MIDI: esperando el permiso"],
    denied: ["MIDI: permission denied (allow it in the site settings)", "MIDI: permiso denegado (permítalo en la configuración del sitio)"],
    "no-device": ["MIDI: no device", "MIDI: sin dispositivo"],
    unavailable: ["MIDI: could not start", "MIDI: no se pudo iniciar"],
  };
  for (const [state, [a, b]] of Object.entries(lines)) {
    assert.equal(midiLine(en, { state, names: [] }), a, state);
    assert.equal(midiLine(es, { state, names: [] }), b, state);
  }
  assert.equal(midiLine(en, { state: "connected", names: ["Casio CDP-S100"] }), "MIDI: Casio CDP-S100");
  assert.equal(midiLine(en, { state: "connected", names: ["Casio CDP-S100", "Other"] }), "MIDI: Casio CDP-S100 +1");
});

test("the panel is two chips, the single Connect piano action and the sound setting; no paragraph of explanation", () => {
  const { q, panel } = setup();
  assert.equal(textOf(q("input-chip")), "Computer keys: on");
  assert.equal(textOf(all(panel.element, (n) => n.attrs["data-input"] === "midi")[0]), "MIDI: not connected");
  assert.equal(textOf(q("input-connect")), "Connect piano");
  assert.equal(textOf(q("input-sound")), "Sound from the app for MIDI");
  assert.equal(all(panel.element, (n) => n.tag === "button").length, 1, "the only action is Connect piano");
  assert.equal(q("input-hint").hidden, true, "no hint before a Connect attempt");
});

test("Connect piano asks for permission only on the click, never when the panel is built", () => {
  const { q, calls } = setup();
  assert.equal(calls.connect, 0);
  q("input-connect").click();
  assert.equal(calls.connect, 1);
});

test("after a Connect that finds nothing the chip and one hint line say so, in both languages", async () => {
  for (const [lang, chip, hint] of [["en", "MIDI: no device", "No MIDI device found. Use the computer keys or tap the keys."], ["es", "MIDI: sin dispositivo", "No se encontró ningún dispositivo MIDI. Use el teclado de la computadora o toque las teclas."]]) {
    const { panel, q } = setup({ lang });
    q("input-connect").click();
    await Promise.resolve();
    panel.setMidiState({ state: "no-device", names: [] });
    assert.equal(textOf(all(panel.element, (n) => n.attrs["data-input"] === "midi")[0]), chip);
    assert.equal(textOf(q("input-hint")), hint);
    assert.equal(q("input-hint").hidden, false);
  }
});

test("counter-proof: no-device before any Connect attempt shows the chip but no hint; connected hides the button", () => {
  const { panel, q } = setup();
  panel.setMidiState({ state: "no-device", names: [] });
  assert.equal(q("input-hint").hidden, true);
  panel.setMidiState({ state: "connected", names: ["Casio CDP-S100"] });
  assert.equal(q("input-connect").hidden, true);
  panel.setMidiState({ state: "unsupported", names: [] });
  assert.equal(q("input-connect").hidden, true, "nothing to connect when the browser has no Web MIDI");
  panel.setMidiState({ state: "denied", names: [] });
  assert.equal(q("input-connect").hidden, false, "a retry is offered after a denial");
});

test("the sound toggle starts off, persists on change, and is read back on the next visit", () => {
  const first = setup();
  assert.equal(first.panel.midiSound(), false);
  const box = first.q("input-midi-sound");
  box.checked = true;
  (box.listeners.change ?? []).forEach((fn) => fn({}));
  assert.equal(first.panel.midiSound(), true);
  assert.equal(first.storage.data["piano-guide:input:midi-sound"], "on");
  const second = setup({ storage: first.storage });
  assert.equal(second.panel.midiSound(), true);
  assert.equal(second.q("input-midi-sound").checked, true);
  box.checked = false;
  (box.listeners.change ?? []).forEach((fn) => fn({}));
  assert.equal(first.storage.data["piano-guide:input:midi-sound"], "off");
});

test("the panel follows the language at once and a failing connect does not break it", async () => {
  const i18n = i18nFor("en");
  const panel = createInputPanel({ i18n, storage: memory(), connect: async () => Promise.reject(new Error("boom")) });
  const connect = all(panel.element, (n) => n.tag === "button")[0];
  i18n.setLang("es");
  assert.equal(textOf(connect), "Conectar el piano");
  connect.click();
  await new Promise((r) => setTimeout(r, 0)); // must not throw an unhandled rejection
  panel.setComputerKeys(false);
  assert.match(textOf(panel.element), /desactivadas/);
  panel.dispose();
  i18n.setLang("en"); // no longer followed, must not throw
});
