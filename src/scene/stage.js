// The stage: WebGL renderer, camera, lights, floor and fog. A sober dark room where the only
// saturated color is the music: a faint gradient backdrop, a warm key light with soft shadows,
// a cool rim, a glossy floor and a pool of light under the keyboard. Reflections come from a tiny
// procedural studio (two softboxes and a ceiling strip) turned into an environment map with
// PMREMGenerator. Core three.js only: no addons, no post-processing, no bloom.
import * as THREE from "three";
import { BACKGROUND } from "./dims.js";
import { FOV_DEG } from "./camera.js";
import { tierSettings } from "../core/quality.js";

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
  shared.shadowMap.enabled = true; // each light decides whether it casts (a tier switch); the default PCF filter softens with `radius`
  shared.domElement.classList.add("scene-canvas");
  return shared;
}

// A radial wash of cool blue behind the notes, darker toward the edges.
function backdropTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 118, 8, 128, 128, 190);
  grad.addColorStop(0, "#141a2a");
  grad.addColorStop(0.55, "#0c0f17");
  grad.addColorStop(1, "#07080c");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A soft warm pool of light on the floor under the keyboard (additive, fades to nothing).
function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,214,160,0.55)");
  grad.addColorStop(0.5, "rgba(255,200,140,0.18)");
  grad.addColorStop(1, "rgba(255,190,120,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The reflected studio: a dark room with two softboxes behind and to the sides and a long strip
// on the ceiling. Emissive values above 1 survive in the half-float cube, which is what makes a
// lacquered surface show a bright, soft highlight instead of a flat gray.
function studioScene() {
  const room = new THREE.Scene();
  const owned = [];
  const panel = (w, h, color, intensity, x, y, z) => {
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
    owned.push(geometry, material);
  };
  const shell = new THREE.BoxGeometry(60, 40, 60);
  const shellMaterial = new THREE.MeshBasicMaterial({ color: "#06070b", side: THREE.BackSide, toneMapped: false });
  room.add(new THREE.Mesh(shell, shellMaterial));
  owned.push(shell, shellMaterial);
  panel(12, 7, "#ffe6c4", 1.6, -17, 9, -12); // warm softbox, back left
  panel(12, 7, "#cfe0ff", 0.55, 17, 9, -12); // cool softbox, back right
  panel(40, 3, "#ffffff", 2, 0, 11, -19); // long strip behind, at the height a key top mirrors from the camera
  panel(30, 2, "#ffffff", 1.6, 0, 19, -3); // ceiling strip
  return { room, dispose: () => owned.forEach((o) => o.dispose()) };
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
  const backdrop = backdropTexture();
  scene.background = backdrop;
  scene.fog = new THREE.Fog(BACKGROUND, 30, 95);

  // Warm key light from above and in front, soft edges and soft shadows; cool rim from behind;
  // dim sky fill. The environment map adds the reflections.
  const key = new THREE.SpotLight("#ffe3bd", 900, 0, 1.05, 0.9, 2);
  key.position.set(0, 15, 15);
  key.target.position.set(0, 0.8, 3);
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 6;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight("#8fb2ff", 0.8);
  rim.position.set(4, 22, -3); // nearly overhead: a glossy floor mirrors a low light into view as a hot spot, a high one below the frame
  const fill = new THREE.HemisphereLight("#9db2d8", "#14161c", 0.5);
  scene.add(key, key.target, rim, fill);

  // Dark floor just below the keybed: glossy under the High tier (it reflects the studio), matte below.
  const floorGeometry = new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: "#0e1014", roughness: 0.22, metalness: 0, envMapIntensity: 0.14 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.62;
  floor.receiveShadow = true;
  scene.add(floor);

  // The pool of light under the keyboard: additive, drawn after the floor and before the key glow.
  const poolMap = poolTexture();
  const poolGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMaterial = new THREE.MeshBasicMaterial({ map: poolMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.5 });
  const pool = new THREE.Mesh(poolGeometry, poolMaterial);
  pool.position.set(0, -0.58, 3.2);
  pool.scale.set(40, 1, 18);
  scene.add(pool);

  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 400);

  let studio = null; // built the first time a tier asks for reflections
  let settings = tierSettings("high");
  let size = null;

  function applyPose({ position, target, fov }) {
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.x, target.y, target.z);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  function setSize(width, height) {
    size = { width, height };
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, settings.pixelRatioCap));
    renderer.setSize(width, height, false); // CSS sizes the canvas; no inline style
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Switch the stage to a tier's settings (see core/quality.js): reflections, shadows, rim light, pixel ratio. */
  function applyTier(next) {
    settings = next;
    if (next.env && !studio) {
      const built = studioScene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      studio = pmrem.fromScene(built.room, 0.03);
      pmrem.dispose();
      built.dispose();
    }
    // The keys take the scene environment (intensity below); the floor holds its own map, because
    // a material's envMapIntensity only counts when the material has an envMap of its own.
    scene.environment = next.env ? studio.texture : null;
    scene.environmentIntensity = 0.85;
    floorMaterial.envMap = next.env ? studio.texture : null;
    floorMaterial.roughness = next.env ? 0.22 : 0.9;
    floorMaterial.needsUpdate = true;
    key.castShadow = next.shadows;
    rim.visible = next.rim;
    pool.visible = next.glow;
    if (size) setSize(size.width, size.height); // the pixel ratio cap may have changed
  }
  applyTier(settings);

  /** Scale the pool of light to the keyboard's width. */
  function fitKeyboard(width) {
    pool.scale.set(width * 1.5 + 8, 1, 18);
  }

  function dispose() {
    floorGeometry.dispose();
    floorMaterial.dispose();
    poolGeometry.dispose();
    poolMaterial.dispose();
    poolMap.dispose();
    backdrop.dispose();
    studio?.dispose();
    key.shadow.map?.dispose();
    canvas.remove(); // the renderer stays alive for the next visit
  }

  return { renderer, scene, camera, applyPose, setSize, applyTier, fitKeyboard, render: () => renderer.render(scene, camera), dispose };
}
