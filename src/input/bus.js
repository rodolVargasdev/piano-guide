// One note bus for every input source (on-screen keys, computer keys, Web MIDI). Consumers subscribe
// here only and never learn which source produced an event. Dispatch is synchronous and in
// subscription order. No DOM, no dependency.

const TYPES = ["noteOn", "noteOff"];

/**
 * createNoteBus({ now }) -> { noteOn, noteOff, releaseAll, held, on, dispose }.
 * Events are { type, midi, source, velocity, time }. A note counts as held per (source, midi): a second
 * noteOn of a held pair (auto-repeat) and a noteOff of a pair that is not held are ignored and return false.
 */
export function createNoteBus({ now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
  const heldNotes = new Map(); // "source:midi" -> { source, midi }
  const listeners = { noteOn: new Set(), noteOff: new Set() };
  let disposed = false;

  // Every listener runs even if one throws; the first error is rethrown afterwards so it is not hidden.
  function emit(type, event) {
    let failure = null;
    for (const fn of [...listeners[type]]) {
      try {
        fn(event);
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  }

  const bus = {
    noteOn(midi, { source = "screen", velocity = 0.7 } = {}) {
      const id = `${source}:${midi}`;
      if (disposed || heldNotes.has(id)) return false;
      heldNotes.set(id, { source, midi });
      emit("noteOn", { type: "noteOn", midi, source, velocity, time: now() });
      return true;
    },

    noteOff(midi, { source = "screen" } = {}) {
      const id = `${source}:${midi}`;
      if (!heldNotes.delete(id)) return false;
      emit("noteOff", { type: "noteOff", midi, source, velocity: 0, time: now() });
      return true;
    },

    /** noteOff for every held note, or only those of one source, in the order they were pressed. */
    releaseAll(source) {
      for (const { source: s, midi } of [...heldNotes.values()]) if (source === undefined || s === source) bus.noteOff(midi, { source: s });
    },

    /** MIDI numbers held now, over all sources. */
    held: () => new Set([...heldNotes.values()].map((n) => n.midi)),

    /** Subscribes to "noteOn" or "noteOff"; returns the unsubscribe function. */
    on(type, fn) {
      if (!TYPES.includes(type)) throw new TypeError(`Unknown note event: ${type}`);
      listeners[type].add(fn);
      return () => listeners[type].delete(fn);
    },

    /** Releases every held note (so consumers see the noteOff), then drops every listener. */
    dispose() {
      bus.releaseAll();
      disposed = true;
      for (const set of Object.values(listeners)) set.clear();
    },
  };
  return bus;
}
