import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScene, nullScene, UNAVAILABLE_MESSAGE } from "../../src/scene/index.js";

// A tiny container and document: enough for the fallback message.
function fakeDom() {
  const container = { children: [], replaceChildren(...n) { this.children = n; } };
  const doc = {
    createElement: (tag) => ({ tag, attrs: {}, className: "", textContent: "", setAttribute(k, v) { this.attrs[k] = v; } }),
  };
  return { container, doc };
}

const SCENE_METHODS = ["setTimeline", "setHandModes", "setRange", "setReducedMotion", "setQuality", "render", "resize", "dispose"];

test("nullScene has the scene interface, every method is a harmless no-op", () => {
  const s = nullScene();
  assert.equal(s.available, false);
  for (const m of SCENE_METHODS) {
    assert.equal(typeof s[m], "function", m);
    assert.doesNotThrow(() => s[m]({}, true));
  }
});

test("when three.js fails to load, createScene resolves to the null scene with the message", async () => {
  const { container, doc } = fakeDom();
  const scene = await createScene(container, { timeline: { notes: [] }, doc, loadThree: async () => { throw new Error("offline"); } });
  assert.equal(scene.available, false);
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].textContent, UNAVAILABLE_MESSAGE);
  assert.equal(container.children[0].attrs.role, "status");
  assert.equal(UNAVAILABLE_MESSAGE, "3D view unavailable on this device");
});

test("when the scene modules cannot run (no browser, no WebGL), createScene still never rejects", async () => {
  // Under node the bare "three" specifier does not resolve, which is the same failure shape as a failed import.
  const { container, doc } = fakeDom();
  const scene = await createScene(container, { timeline: { notes: [] }, doc });
  assert.equal(scene.available, false);
  assert.equal(container.children[0].textContent, UNAVAILABLE_MESSAGE);
  const ok = await createScene(container, { timeline: { notes: [] }, doc, loadThree: async () => ({}) });
  assert.equal(ok.available, false, "a failure after three loaded (stage or WebGL) falls back too");
});

// Guard: only the scene modules that run after the lazy import may import three. The catalog,
// router, player, main and the scene facade must not, or the catalog would download three.js.
const STATIC_THREE = /^\s*import\s[^;]*from\s+["']three["']/m;
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("no module on the catalog path imports three statically", () => {
  for (const p of ["src/main.js", "src/ui/router.js", "src/ui/catalog.js", "src/ui/player.js", "src/ui/transport.js", "src/scene/index.js", "src/scene/camera.js", "src/scene/dims.js", "src/scene/key-state.js"]) {
    assert.equal(STATIC_THREE.test(read(p)), false, `${p} must not import three statically`);
  }
});

test("counter-proof: the guard pattern does detect a static three import, and the 3D modules do have one", () => {
  assert.equal(STATIC_THREE.test('import * as THREE from "three";\n'), true);
  assert.equal(STATIC_THREE.test("import { Scene } from 'three';"), true);
  assert.equal(STATIC_THREE.test('const x = await import("three");'), false);
  for (const p of ["src/scene/stage.js", "src/scene/keyboard.js"]) assert.equal(STATIC_THREE.test(read(p)), true, p);
});
