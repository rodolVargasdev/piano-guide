// The stage: WebGL renderer, camera, lights, floor and fog. A sober dark room where the only
// saturated color is the music. Core three.js only (no addons, no post-processing).
import * as THREE from "three";
import { BACKGROUND } from "./dims.js";
import { FOV_DEG } from "./camera.js";

// One WebGLRenderer (one GL context) for the whole page, like the shared AudioContext: opening
// and leaving the player many times reuses it. Creating and destroying a context on every visit
// left a context and its canvas behind in headless Chrome (measured, see PR 11b), so the renderer
// outlives the player and each visit frees only its own scene resources.
let shared = null;

function sharedRenderer() {
  if (shared && !shared.getContext().isContextLost()) return shared;
  shared?.dispose();
  shared = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  shared.toneMapping = THREE.ACESFilmicToneMapping;
  shared.toneMappingExposure = 1.05;
  shared.outputColorSpace = THREE.SRGBColorSpace;
  shared.setClearColor(BACKGROUND);
  shared.localClippingEnabled = true; // the note field is clipped by world-space planes
  shared.domElement.classList.add("scene-canvas");
  return shared;
}

/**
 * createStage(container) attaches the shared renderer's canvas to `container` (replacing its
 * children) and builds the scene around it. Throws when WebGL cannot be created; the caller turns
 * that into the fallback message.
 */
export function createStage(container, win = window) {
  const renderer = sharedRenderer();
  const canvas = renderer.domElement;
  container.replaceChildren(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, 30, 95);

  // Warm key light from above and in front, soft edges; cool rim from behind; dim sky fill.
  const key = new THREE.SpotLight("#ffe3bd", 900, 0, 1.05, 0.9, 2);
  key.position.set(0, 15, 15);
  key.target.position.set(0, 0.8, 3);
  const rim = new THREE.DirectionalLight("#8fb2ff", 1.4);
  rim.position.set(0, 9, -12);
  const fill = new THREE.HemisphereLight("#9db2d8", "#14161c", 0.7);
  scene.add(key, key.target, rim, fill);

  // Matte dark floor under the keyboard, just below the keybed.
  const floorGeometry = new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: "#0e1014", roughness: 0.9, metalness: 0 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.62;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 400);

  function applyPose({ position, target, fov }) {
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.x, target.y, target.z);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  function setSize(width, height) {
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false); // CSS sizes the canvas; no inline style
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    floorGeometry.dispose();
    floorMaterial.dispose();
    canvas.remove(); // the renderer stays alive for the next visit
  }

  return { renderer, scene, camera, applyPose, setSize, render: () => renderer.render(scene, camera), dispose };
}
