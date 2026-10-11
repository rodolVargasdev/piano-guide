// Computer keyboard as a piano: keys are mapped by physical position (KeyboardEvent.code), so any
// layout plays the key drawn on screen. The home row plays white keys and the row above the black keys
// between them. Events with Ctrl, Alt or Meta, events aimed at a text control, auto-repeat and unmapped
// keys never produce a note, and the page keeps its normal behavior for them. No dependency.

export const HOME_ROW = Object.freeze(["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"]);
// UPPER_ROW[i] sits physically between HOME_ROW[i] and HOME_ROW[i + 1].
export const UPPER_ROW = Object.freeze(["KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft"]);

/** Labels printed on a US keyboard, the fallback when the layout map is not available. */
export const US_LABELS = Object.freeze({
  KeyA: "A", KeyS: "S", KeyD: "D", KeyF: "F", KeyG: "G", KeyH: "H", KeyJ: "J", KeyK: "K", KeyL: "L", Semicolon: ";", Quote: "'",
  KeyW: "W", KeyE: "E", KeyR: "R", KeyT: "T", KeyY: "Y", KeyU: "U", KeyI: "I", KeyO: "O", KeyP: "P", BracketLeft: "[",
});

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const isWhite = (midi) => WHITE_PCS.has(((midi % 12) + 12) % 12);

/**
 * keyMapFor(region, anchorMidi) -> Map<code, midi>. `region` is { low, high } (MIDI of its edge white keys).
 * Eleven white keys from the white key at or below `anchorMidi`, black keys on the row above wherever a
 * black key lies between two mapped white keys. The map stays inside the region: an anchor below it is
 * raised, one too near the top is moved down so as many keys as the region has are mapped.
 */
export function keyMapFor(region, anchorMidi) {
  const whites = [];
  for (let m = region.low; m <= region.high; m += 1) if (isWhite(m)) whites.push(m);
  let anchor = whites.findLastIndex((m) => m <= anchorMidi);
  anchor = Math.max(0, anchor);
  const start = Math.min(anchor, Math.max(0, whites.length - HOME_ROW.length));
  const mapped = whites.slice(start, start + HOME_ROW.length);
  const map = new Map();
  mapped.forEach((midi, i) => {
    map.set(HOME_ROW[i], midi);
    if (i + 1 < mapped.length && mapped[i + 1] - midi === 2) map.set(UPPER_ROW[i], midi + 1);
  });
  return map;
}

const isEditable = (el) => ["INPUT", "SELECT", "TEXTAREA"].includes(String(el?.tagName).toUpperCase()) || el?.isContentEditable === true;

/**
 * attachComputerKeys({ target, bus, getMap, doc }) -> detach. `getMap()` gives the current code -> midi map
 * (it may change between calls as the region moves). The note a key played is remembered at press time, so
 * its key-up releases that note even if the map moved. Blur and a hidden page release everything.
 */
export function attachComputerKeys({ target, bus, getMap, doc = target.document ?? globalThis.document }) {
  const down = new Map(); // code -> midi, as pressed

  const onKeyDown = (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || isEditable(event.target)) return;
    const midi = getMap().get(event.code);
    if (midi === undefined) return;
    event.preventDefault(); // a mapped key is ours: no quick-find, no scrolling
    if (event.repeat || down.has(event.code)) return;
    down.set(event.code, midi);
    bus.noteOn(midi, { source: "computer" });
  };
  // A key-up always releases what that key pressed, whatever modifier or focus is current now.
  const onKeyUp = (event) => {
    if (!down.has(event.code)) return;
    const midi = down.get(event.code);
    down.delete(event.code);
    bus.noteOff(midi, { source: "computer" });
  };
  const releaseAll = () => {
    down.clear();
    bus.releaseAll("computer");
  };
  const onVisibility = () => {
    if (doc?.hidden) releaseAll();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", releaseAll);
  doc?.addEventListener?.("visibilitychange", onVisibility);
  return function detach() {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", releaseAll);
    doc?.removeEventListener?.("visibilitychange", onVisibility);
    releaseAll();
  };
}

/**
 * legendFor(codes, nav) -> Promise<Map<code, label>>: the letters printed on the learner's keycaps from
 * `navigator.keyboard.getLayoutMap()` when it exists (so a Spanish layout shows its own letter on
 * Semicolon), else the US table. Never rejects.
 */
export async function legendFor(codes, nav = globalThis.navigator) {
  let layout = null;
  try {
    layout = (await nav?.keyboard?.getLayoutMap?.()) ?? null;
  } catch {
    layout = null;
  }
  return new Map(
    [...codes].map((code) => {
      const printed = layout?.get(code);
      return [code, typeof printed === "string" && printed !== "" ? (printed.length === 1 ? printed.toUpperCase() : printed) : (US_LABELS[code] ?? "")];
    }),
  );
}
