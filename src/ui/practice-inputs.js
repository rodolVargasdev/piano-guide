// The inputs and the sound of a practice page: one note bus fed by the screen keys, the computer keys and MIDI,
// the learner's own sound (first subscriber, so a press is never delayed), the input panel and the audio engine.
// The same wiring the Learn view uses, shared by the exercise page, the ear drills and the routine.
import { createAudio } from "../audio/context.js";
import { createEngine } from "../audio/engine.js";
import { HOME_ROW, UPPER_ROW, attachComputerKeys, legendFor } from "../input/computer-keys.js";
import { createNoteBus } from "../input/bus.js";
import { createLearnerSound } from "../input/learner-sound.js";
import { createMidiInput } from "../input/midi.js";
import { createInputPanel } from "./input-panel.js";

let sharedAudio = null;
/** The real engine on a shared audio context (a context is expensive and the browser limits how many there can be). */
export const defaultMakeEngine = () => createEngine({ audio: (sharedAudio ??= createAudio()) });

/**
 * createPracticeInputs({ i18n, win, storage, makeEngine }) -> { bus, engine, panel, setKeyMap(map), legend(), onLegend(fn), dispose() }.
 * `setKeyMap` gives the computer keys their current code -> midi map; `legend()` is the printed letter of each code
 * (the US letters until the layout map answers, then the learner's own, and `onLegend` tells the page to redraw).
 */
export function createPracticeInputs({ i18n, win, storage, makeEngine = defaultMakeEngine }) {
  const bus = createNoteBus();
  const engine = makeEngine();
  let panel = null;
  const sound = createLearnerSound({ bus, engine, settings: { midiSound: () => panel?.midiSound() === true } });
  const midi = createMidiInput({ navigator: win.navigator, isSecureContext: win.isSecureContext, bus, onState: (st) => panel?.setMidiState(st) });
  panel = createInputPanel({ i18n, storage, connect: () => midi.connect(), midi: { state: midi.state(), names: [] } });
  panel.setComputerKeys(true);

  let keyMap = new Map();
  let legend = new Map();
  let disposed = false;
  const legendListeners = new Set();
  const detachKeys = attachComputerKeys({ target: win, bus, getMap: () => keyMap, doc: win.document });
  legendFor([...HOME_ROW, ...UPPER_ROW], win.navigator).then((map) => {
    if (disposed) return;
    legend = map;
    for (const fn of [...legendListeners]) fn();
  });

  return {
    bus,
    engine,
    panel,
    setKeyMap(map) {
      keyMap = map;
    },
    legend: () => legend,
    onLegend(fn) {
      legendListeners.add(fn);
      return () => legendListeners.delete(fn);
    },
    dispose() {
      disposed = true;
      legendListeners.clear();
      detachKeys();
      midi.dispose();
      sound.dispose();
      panel.dispose();
      bus.dispose();
      engine.dispose?.();
    },
  };
}
