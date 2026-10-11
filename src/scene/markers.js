// Finger markers and shift rings: ONE instanced billboard mesh over a canvas atlas, drawn last
// (depthTest off) so no stage effect or falling note covers a number. The hand is told apart by
// shape as well as color: right-hand markers are circles, left-hand markers are rounded squares,
// each with a small "R" or "L" in the corner. What to show at a tick comes from the pure plan in
// marker-plan.js; this file writes it into reused typed arrays (no allocation per frame) and the
// whole set is a single draw call however many markers are visible.
import * as THREE from "three";
import { isBlackKey } from "../core/keyboard-layout.js";
import { createMarkerPlan, ringStrength, MAX_MARKERS, GHOST_ALPHA, HAND_BIT } from "./marker-plan.js";
import { HAND_COLOR, WHITE_TOP, BLACK_TOP, WHITE_LENGTH, BLACK_LENGTH } from "./dims.js";

const RINGS = 8; // shift rings drawn at once; a few shifts can approach together
const CELL = 128; // atlas cell side in pixels
const COLS = 6; // fingers 1 to 5 and the ring
const ROWS = 2; // right hand, left hand (the ring uses the first row)
const RING_CELL = 5;
const RING_COLOR = "#f8fafc";

function drawMarker(g, ox, oy, hand, finger) {
  const color = HAND_COLOR[hand];
  g.fillStyle = "rgba(11, 13, 18, 0.92)";
  g.strokeStyle = color;
  g.lineWidth = 9;
  g.beginPath();
  if (hand === "R") g.arc(ox + 64, oy + 64, 46, 0, Math.PI * 2);
  else g.roundRect(ox + 18, oy + 18, 92, 92, 20);
  g.fill();
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = "700 60px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(finger), ox + 64, oy + 68);
  g.fillStyle = color;
  g.font = "700 26px system-ui, sans-serif";
  g.fillText(hand, ox + 112, oy + 16); // the corner mark, outside the shape
}

function atlas() {
  const c = document.createElement("canvas");
  c.width = COLS * CELL;
  c.height = ROWS * CELL;
  const g = c.getContext("2d");
  ["R", "L"].forEach((hand, row) => {
    for (let f = 1; f <= 5; f += 1) drawMarker(g, (f - 1) * CELL, row * CELL, hand, f);
  });
  // A dark outline under a bright ring, so the ring reads on a white key and on a black one.
  for (const [style, width] of [["rgba(11, 13, 18, 0.9)", 16], [RING_COLOR, 8]]) {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    g.arc(RING_CELL * CELL + 64, 64, 54, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; // sampled and written as is, like a tone-mapping-free sprite
  return t;
}

// Billboard: each instance is a quad centered on a world position and always facing the camera.
const VERTEX = `
attribute vec4 aPlace; // xyz: position, w: size
attribute vec3 aCell;  // x: atlas column, y: atlas row, z: opacity
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = vec2((aCell.x + uv.x) / ${COLS}.0, 1.0 - (aCell.y + 1.0 - uv.y) / ${ROWS}.0);
  vAlpha = aCell.z;
  vec4 mv = modelViewMatrix * vec4(aPlace.xyz, 1.0);
  mv.xy += position.xy * aPlace.w;
  gl_Position = projectionMatrix * mv;
}`;
const FRAGMENT = `
uniform sampler2D map;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 c = texture2D(map, vUv);
  gl_FragColor = vec4(c.rgb, c.a * vAlpha);
}`;

/**
 * createMarkers({ timeline, keyboard }) returns { group, update(tick, handModes, reducedMotion),
 * dispose() }. Rebuild it with the keyboard; `update` is the per-frame call.
 */
export function createMarkers({ timeline, keyboard }) {
  const plan = createMarkerPlan(timeline);
  const group = new THREE.Group();
  const max = MAX_MARKERS + RINGS;
  const place = new Float32Array(max * 4);
  const cell = new Float32Array(max * 3);
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setAttribute("uv", quad.getAttribute("uv"));
  const placeAttr = new THREE.InstancedBufferAttribute(place, 4).setUsage(THREE.DynamicDrawUsage);
  const cellAttr = new THREE.InstancedBufferAttribute(cell, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aPlace", placeAttr);
  geometry.setAttribute("aCell", cellAttr);
  geometry.instanceCount = 0;
  const map = atlas();
  const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { map: { value: map } }, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10; // after the key glow (1) and the chord outline (2)
  mesh.visible = false;
  group.add(mesh);

  let n = 0;
  // One instance: world position on the key, size as a multiple of the drawn key width (a little
  // wider on black keys, which are narrow), atlas cell and opacity.
  function put(midi, whiteScale, blackScale, col, row, alpha) {
    const black = isBlackKey(midi);
    const p = n * 4;
    place[p] = keyboard.centerX[midi];
    place[p + 1] = (black ? BLACK_TOP : WHITE_TOP) + 0.55;
    place[p + 2] = black ? BLACK_LENGTH * 0.55 : WHITE_LENGTH * 0.78;
    place[p + 3] = keyboard.keyWidth[midi] * (black ? blackScale : whiteScale);
    const c = n * 3;
    cell[c] = col;
    cell[c + 1] = row;
    cell[c + 2] = alpha;
    n += 1;
  }

  return {
    group,
    update(tick, handModes, reducedMotion) {
      plan.update(tick, handModes);
      n = 0;
      const pulse = ringStrength(tick, plan.beat, reducedMotion);
      let rings = 0;
      for (let i = 0; i < plan.count && rings < RINGS; i += 1) {
        if (plan.ring[i] === 1 && keyboard.hasKey(plan.midi[i])) {
          put(plan.midi[i], 1.75, 1.9, RING_CELL, 0, pulse);
          rings += 1;
        }
      }
      for (let i = 0; i < plan.count; i += 1) {
        if (plan.finger[i] === 0 || !keyboard.hasKey(plan.midi[i])) continue; // no finger, no marker: the lit key is the cue
        put(plan.midi[i], 1.3, 1.5, plan.finger[i] - 1, plan.hand[i] === HAND_BIT.L ? 1 : 0, plan.ghost[i] === 1 ? GHOST_ALPHA : 1);
      }
      geometry.instanceCount = n;
      mesh.visible = n > 0;
      placeAttr.needsUpdate = true;
      cellAttr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      quad.dispose();
      material.dispose();
      map.dispose();
      group.clear();
    },
  };
}
