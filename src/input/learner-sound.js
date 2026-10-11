// The sound of the learner's own keys. On-screen and computer keys always sound; MIDI sounds only when
// the remembered setting is on (default off: the digital piano already sounds). The rule never asks the
// matcher, so a wrong key sounds like any other, and it never waits for it. No dependency, no DOM.

export const MIDI_SOUND_KEY = "piano-guide:input:midi-sound";

/** The remembered "Sound from the app for MIDI" setting; absent or unreadable means off. */
export function readMidiSound(storage) {
  try {
    return storage?.getItem(MIDI_SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

/** Saves the setting; a blocked store is ignored (the setting then lasts for the session only). */
export function writeMidiSound(storage, on) {
  try {
    storage.setItem(MIDI_SOUND_KEY, on ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}

/**
 * createLearnerSound({ bus, engine, settings }) -> { dispose }. `settings.midiSound()` is read at every
 * MIDI press, so switching the toggle takes effect at once. A note is released when the last source that
 * pressed it lets go, and a release always follows a start even if the setting changed in between.
 */
export function createLearnerSound({ bus, engine, settings }) {
  const sounding = new Map(); // midi -> Set of sources that started it

  const audible = (source) => source === "screen" || source === "computer" || (source === "midi" && settings.midiSound() === true);
  // Not having Web Audio must not break the lesson: the press still reaches the matcher.
  const safely = (fn) => {
    try {
      fn();
    } catch {
      // no sound is not fatal
    }
  };

  const offOn = bus.on("noteOn", (e) => {
    if (!audible(e.source)) return;
    const sources = sounding.get(e.midi) ?? new Set();
    sources.add(e.source);
    sounding.set(e.midi, sources);
    safely(() => engine.startNote(e.midi, { vel: e.velocity }));
  });
  const offOff = bus.on("noteOff", (e) => {
    const sources = sounding.get(e.midi);
    if (!sources?.delete(e.source)) return;
    if (sources.size > 0) return; // another source still holds this note
    sounding.delete(e.midi);
    safely(() => engine.releaseNote(e.midi));
  });

  return {
    dispose() {
      offOn();
      offOff();
      for (const midi of sounding.keys()) safely(() => engine.releaseNote(midi));
      sounding.clear();
    },
  };
}
