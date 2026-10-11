// The falling notes: ONE instanced mesh per hand, placed once in tick space. Every frame only
// the parent group's position.y changes (see notes-layout.js), so a seek needs no rebuild and the
// render path allocates nothing. Two world-space clipping planes cut everything below the key-top
// line and above the look-ahead horizon, so notes outside the bounded window are not drawn.
// Hand cue besides color: left-hand bars carry long stripes, right-hand bars are plain.
import * as THREE from "three";
import { HAND_COLOR, LANDING_Y } from "./dims.js";
import { NOTE_DEPTH, HORIZON_BARS, unitsPerTick, groupY, horizonY, noteBox, fallingNotes } from "./notes-layout.js";

// 32 x 32 shading texture: a brighter leading (lower) edge fading upward; `striped` adds three
// long dark lines along the bar (they follow the bar length, so they never stretch).
function shadeTexture(striped) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  for (let y = 0; y < 32; y += 1) {
    const level = 193 + Math.round((y / 31) * 62); // the canvas bottom row is the lower edge: brightest
    for (let x = 0; x < 32; x += 1) {
      const dark = striped && x % 11 > 7 ? 0.55 : 1;
      const v = Math.round(level * dark);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * createFallingNotes({ timeline, keyboard, handModes, range, bars }) returns
 * { group, update(tick), setHorizonBars(bars), dispose() }. Rebuild it when the timeline,
 * range or hand visibility changes; `update` is the only per-frame call.
 */
export function createFallingNotes({ timeline, keyboard, handModes, range, bars = HORIZON_BARS }) {
  const upt = unitsPerTick(timeline.meter);
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // lower edge at y = 0
  const owned = [geometry];
  const notes = fallingNotes(timeline, handModes, range);

  const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -LANDING_Y), new THREE.Plane(new THREE.Vector3(0, -1, 0), horizonY(bars))];

  for (const hand of ["L", "R"]) {
    const mine = notes.filter((n) => n.hand === hand);
    if (mine.length === 0) continue;
    const tex = shadeTexture(hand === "L");
    const material = new THREE.MeshStandardMaterial({
      color: HAND_COLOR[hand],
      map: tex,
      emissive: HAND_COLOR[hand],
      emissiveIntensity: 0.3,
      roughness: 0.55,
      metalness: 0,
      clippingPlanes: planes,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, mine.length);
    mesh.frustumCulled = false; // the clipping planes bound what is drawn
    mine.forEach((n, i) => {
      const box = noteBox(n, upt);
      dummy.position.set(keyboard.centerX[n.midi], box.y, -NOTE_DEPTH / 2);
      dummy.scale.set(keyboard.keyWidth[n.midi] * 0.92, box.height, NOTE_DEPTH);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    group.add(mesh);
    owned.push(material, tex, mesh);
  }

  return {
    group,
    /** Move the whole field so `tick` sits on the key-top line. */
    update(tick) {
      group.position.y = groupY(tick, upt);
    },
    setHorizonBars(b) {
      planes[1].constant = horizonY(b);
    },
    dispose() {
      for (const o of owned) o.dispose();
      group.clear();
    },
  };
}
