// The 3D keyboard: white and black keys as two InstancedMeshes plus one additive glow mesh.
// A pressed key rotates about its back edge (always, also under reduced motion) and takes its
// hand color; a soft glow quad appears over it. Imports three through the page import map.
import * as THREE from "three";
import { layoutRange, isBlackKey } from "../core/keyboard-layout.js";
import {
  WHITE_LENGTH,
  BLACK_LENGTH,
  WHITE_TOP,
  BLACK_TOP,
  BLACK_HEIGHT,
  KEY_GAP,
  PRESS_ANGLE,
  BLACK_PRESS_ANGLE,
  HAND_COLOR,
  KEY_REST_COLOR,
  HIGHLIGHT_COLOR,
} from "./dims.js";
import { diffHighlight } from "./key-state.js";

// A thin frame drawn once on a canvas; the halo quads tint it with the highlight color.
function frameTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 128;
  const g = c.getContext("2d");
  g.strokeStyle = "#fff";
  g.lineWidth = 6;
  g.strokeRect(3, 3, 26, 122);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A soft round falloff drawn once on a canvas; the glow quads multiply it by the hand color.
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * One keyboard for an inclusive MIDI range. Returns { group, width, centerX, keyWidth, hasKey,
 * setPressed, highlight, setGlow, dispose }; `centerX[midi]` and `keyWidth[midi]` place the falling notes over each key.
 */
export function createKeyboard(range) {
  const { whites, blacks, width } = layoutRange(range);
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const tmp = new THREE.Matrix4();
  // Top face at y = 0, back edge at z = 0, front edge at z = 1: scaling gives the real key.
  const keyGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0.5);
  const slot = new Map(); // midi -> { black, i }
  const centerX = new Float32Array(128); // world x of each key's center, for the note field
  const drawnWidth = new Float32Array(128);
  const owned = [keyGeometry]; // everything to dispose

  const hand = { L: new THREE.Color(HAND_COLOR.L), R: new THREE.Color(HAND_COLOR.R) };
  const palette = (rest, mix) => {
    const base = new THREE.Color(rest);
    const tint = (h) => base.clone().lerp(h, mix);
    return [base, tint(hand.L), tint(hand.R), tint(hand.R)]; // index = pressed bits, both hands show right
  };
  const colors = { white: palette(KEY_REST_COLOR.white, 0.72), black: palette(KEY_REST_COLOR.black, 0.85) };

  function keyMesh(list, black) {
    // Ivory-like white keys with a light clearcoat; lacquered black keys that reflect the studio.
    const mesh = new THREE.InstancedMesh(
      keyGeometry,
      new THREE.MeshPhysicalMaterial({ roughness: black ? 0.18 : 0.35, metalness: 0, clearcoat: black ? 0.8 : 0.3, clearcoatRoughness: black ? 0.08 : 0.25 }),
      list.length,
    );
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const rest = new Float32Array(list.length * 16);
    const down = new Float32Array(list.length * 16);
    list.forEach((k, i) => {
      const w = black ? k.width : k.width - KEY_GAP;
      dummy.position.set(k.x + k.width / 2 - width / 2, black ? BLACK_TOP : WHITE_TOP, 0);
      dummy.scale.set(w, black ? BLACK_HEIGHT : WHITE_TOP, black ? BLACK_LENGTH : WHITE_LENGTH);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dummy.matrix.toArray(rest, i * 16);
      dummy.rotation.x = black ? BLACK_PRESS_ANGLE : PRESS_ANGLE;
      dummy.updateMatrix();
      dummy.matrix.toArray(down, i * 16);
      mesh.setMatrixAt(i, tmp.fromArray(rest, i * 16));
      mesh.setColorAt(i, colors[black ? "black" : "white"][0]);
      slot.set(k.midi, { black, i });
      centerX[k.midi] = k.x + k.width / 2 - width / 2;
      drawnWidth[k.midi] = w;
    });
    group.add(mesh);
    owned.push(mesh.material);
    return { mesh, rest, down };
  }
  const white = keyMesh(whites, false);
  const black = keyMesh(blacks, true);

  // Glow: one flat additive quad per key, scaled to zero while the key is up.
  const glowTex = glowTexture();
  const glowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glowCount = whites.length + blacks.length;
  const glow = new THREE.InstancedMesh(glowGeometry, glowMat, glowCount);
  glow.frustumCulled = false;
  glow.renderOrder = 1;
  const glowOn = new Float32Array(glowCount * 16);
  const glowOff = new Float32Array(glowCount * 16);
  [...whites, ...blacks].forEach((k, gi) => {
    const isB = gi >= whites.length;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(k.x + k.width / 2 - width / 2, (isB ? BLACK_TOP : WHITE_TOP) + 0.04, isB ? BLACK_LENGTH * 0.55 : WHITE_LENGTH * 0.78);
    dummy.scale.set(k.width * 2.4, 1, isB ? 2.6 : 3.4);
    dummy.updateMatrix();
    dummy.matrix.toArray(glowOn, gi * 16);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(glowOff, gi * 16);
    glow.setMatrixAt(gi, tmp.fromArray(glowOff, gi * 16));
    glow.setColorAt(gi, hand.R);
    slot.get(k.midi).glow = gi;
  });
  group.add(glow);
  owned.push(glowGeometry, glowMat, glowTex);

  // Halo: a flat outline per key for the lesson card, independent of playback (scaled to zero when off).
  const haloTex = frameTexture();
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: HIGHLIGHT_COLOR, transparent: true, depthWrite: false, toneMapped: false });
  const halo = new THREE.InstancedMesh(glowGeometry, haloMat, glowCount);
  halo.frustumCulled = false;
  halo.renderOrder = 2;
  const haloOn = new Float32Array(glowCount * 16);
  const haloOff = new Float32Array(glowCount * 16);
  [...whites, ...blacks].forEach((k, gi) => {
    const isB = gi >= whites.length;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(k.x + k.width / 2 - width / 2, (isB ? BLACK_TOP : WHITE_TOP) + 0.06, isB ? BLACK_LENGTH / 2 : WHITE_LENGTH / 2);
    dummy.scale.set(isB ? k.width : k.width - KEY_GAP, 1, isB ? BLACK_LENGTH : WHITE_LENGTH);
    dummy.updateMatrix();
    dummy.matrix.toArray(haloOn, gi * 16);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(haloOff, gi * 16);
    halo.setMatrixAt(gi, tmp.fromArray(haloOff, gi * 16));
  });
  group.add(halo);
  owned.push(haloMat, haloTex);
  let lit = [];

  // Lacquered keybed and cheek blocks frame the keys.
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: "#0a0b0f", roughness: 0.3, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const part = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, bodyMat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.position.set(x, y, z);
    group.add(m);
    owned.push(g);
  };
  part(width + 1.2, 0.6, WHITE_LENGTH + 1.4, 0, -0.3, (WHITE_LENGTH + 0.8) / 2 - 0.6); // keybed
  part(0.6, 2.4, WHITE_LENGTH + 1.4, -(width / 2 + 0.3), 0.6, (WHITE_LENGTH + 0.8) / 2 - 0.6); // left cheek
  part(0.6, 2.4, WHITE_LENGTH + 1.4, width / 2 + 0.3, 0.6, (WHITE_LENGTH + 0.8) / 2 - 0.6); // right cheek
  owned.push(bodyMat);

  /** `bits` is a set of HAND_L (1) and HAND_R (2); 0 returns the key to rest. Ignores keys outside the range. */
  function setPressed(midi, bits) {
    const s = slot.get(midi);
    if (!s) return;
    const set = s.black ? black : white;
    const key = isBlackKey(midi) ? "black" : "white";
    set.mesh.setMatrixAt(s.i, tmp.fromArray(bits ? set.down : set.rest, s.i * 16));
    set.mesh.setColorAt(s.i, colors[key][bits & 3]);
    set.mesh.instanceMatrix.needsUpdate = true;
    set.mesh.instanceColor.needsUpdate = true;
    glow.setMatrixAt(s.glow, tmp.fromArray(bits ? glowOn : glowOff, s.glow * 16));
    glow.setColorAt(s.glow, hand[bits === 1 ? "L" : "R"]);
    glow.instanceMatrix.needsUpdate = true;
    glow.instanceColor.needsUpdate = true;
  }

  /** Outline exactly these MIDI keys (others are cleared); an empty array clears the outline. */
  function highlight(midis) {
    const d = diffHighlight(lit, midis, (m) => slot.has(m));
    lit = d.lit;
    for (const m of d.off) halo.setMatrixAt(slot.get(m).glow, tmp.fromArray(haloOff, slot.get(m).glow * 16));
    for (const m of d.on) halo.setMatrixAt(slot.get(m).glow, tmp.fromArray(haloOn, slot.get(m).glow * 16));
    halo.instanceMatrix.needsUpdate = true;
  }

  /** The additive glow over pressed keys: on for the High and Medium tiers, off below. */
  function setGlow(on) {
    glow.visible = on;
  }

  function dispose() {
    for (const m of [white.mesh, black.mesh, glow, halo]) m.dispose();
    for (const o of owned) o.dispose();
    group.clear();
  }

  return { group, width, centerX, keyWidth: drawnWidth, hasKey: (midi) => slot.has(midi), setPressed, highlight, setGlow, dispose };
}
