// Key matcher of one lesson step: a pure reducer over note events. It knows nothing about the input
// source (screen, computer keys, MIDI) and keeps no clock: a step is never failed by waiting, and the
// keys of a chord count in any order however far apart they arrive. Pure, no DOM.

const pitchClass = (midi) => ((midi % 12) + 12) % 12;

/**
 * startStep(expectedMidis, heldMidis, { match }) -> matcher state.
 * `match` is "exact" (the default: the very MIDI keys) or "pitchClass" (any octave, as "any C counts" in
 * lesson zero). Keys in `heldMidis` are down when the step begins: they neither satisfy nor spoil it and
 * only count again after being released and pressed anew.
 */
export function startStep(expectedMidis, heldMidis = [], { match = "exact" } = {}) {
  return {
    match,
    expected: [...new Set(expectedMidis)].sort((a, b) => a - b),
    held: new Set(heldMidis),
    down: new Set(),
    pressed: new Set(),
    satisfied: false,
  };
}

const covered = (m, pressed) => {
  if (m.match === "pitchClass") {
    const have = new Set([...pressed].map(pitchClass));
    return m.expected.every((e) => have.has(pitchClass(e)));
  }
  return m.expected.every((e) => pressed.has(e));
};

const isExpected = (m, midi) => (m.match === "pitchClass" ? m.expected.some((e) => pitchClass(e) === pitchClass(midi)) : m.expected.includes(midi));

/**
 * matchEvent(m, { type: "on" | "off", midi }) -> { m, outcome }.
 * Outcomes: "progress" (an expected key was added), "satisfied" (the last expected key arrived),
 * "wrong" (an unexpected key: the accumulation is cleared and the lesson does not move),
 * "octave" (a wrong key with the pitch class of an expected one, exact mode only: feedback variant),
 * "ignored" (any off event, a key held from before the step, an auto-repeat, or any event after the step is satisfied).
 */
export function matchEvent(m, event) {
  if (event.type === "off") {
    const held = new Set(m.held);
    const down = new Set(m.down);
    held.delete(event.midi);
    down.delete(event.midi);
    return { m: { ...m, held, down }, outcome: "ignored" };
  }
  if (m.satisfied || m.held.has(event.midi) || m.down.has(event.midi)) return { m, outcome: "ignored" };
  const down = new Set(m.down).add(event.midi);
  if (isExpected(m, event.midi)) {
    const pressed = new Set(m.pressed).add(event.midi);
    const satisfied = covered(m, pressed);
    return { m: { ...m, down, pressed, satisfied }, outcome: satisfied ? "satisfied" : "progress" };
  }
  const sameClass = m.match === "exact" && m.expected.some((e) => pitchClass(e) === pitchClass(event.midi));
  return { m: { ...m, down, pressed: new Set() }, outcome: sameClass ? "octave" : "wrong" };
}
