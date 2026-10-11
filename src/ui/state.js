// Minimal observable store. No DOM, no dependencies.

/**
 * createStore(initial) returns { get, set, subscribe }.
 * - get() returns the current state object; get(key) returns one value.
 * - set(key, value) or set({ key: value, ... }) updates state and notifies each
 *   subscriber once per call, and only when some value actually changed.
 * - subscribe(fn) returns an unsubscribe function; fn(state, previousState).
 */
export function createStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get(key) {
      return key === undefined ? state : state[key];
    },
    set(keyOrPatch, value) {
      const patch = typeof keyOrPatch === "string" ? { [keyOrPatch]: value } : keyOrPatch;
      const changed = Object.keys(patch).some((k) => !Object.is(state[k], patch[k]));
      if (!changed) return;
      const previous = state;
      state = { ...state, ...patch };
      for (const fn of [...listeners]) fn(state, previous);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}
