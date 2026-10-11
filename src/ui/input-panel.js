// Input panel of the Learn view: one short chip per input source, the single "Connect piano" action and the
// "Sound from the app for MIDI" setting. No paragraphs: each state is one line. Permission for MIDI is asked
// only from the click on the button (note-input spec). Text goes through the translator.
import { readMidiSound, writeMidiSound } from "../input/learner-sound.js";
import { el } from "./dom.js";

const STATE_KEY = {
  unsupported: "input.midi.unsupported",
  insecure: "input.midi.insecure",
  idle: "input.midi.idle",
  requesting: "input.midi.requesting",
  denied: "input.midi.denied",
  "no-device": "input.midi.noDevice",
  unavailable: "input.midi.unavailable",
};
// States from which pressing "Connect piano" can help (try again, or look again after plugging the cable in).
const CAN_CONNECT = new Set(["idle", "denied", "no-device", "unavailable"]);

/** The one-line MIDI chip text for a midi state { state, names }. */
export function midiLine(i18n, { state, names = [] }) {
  if (state === "connected") {
    return names.length > 1 ? i18n.t("input.midi.connectedMore", { name: names[0], more: names.length - 1 }) : i18n.t("input.midi.connected", { name: names[0] ?? "" });
  }
  return i18n.t(STATE_KEY[state] ?? STATE_KEY.unavailable);
}

/**
 * createInputPanel({ i18n, storage, connect, midi }) -> { element, setMidiState(s), setComputerKeys(on), midiSound(), dispose() }.
 * `connect()` is called only from the button and may resolve with the state it reached; `midi` is the
 * initial { state, names }. The hint "No MIDI device found..." appears only after a Connect attempt that found nothing.
 */
export function createInputPanel({ i18n, storage, connect, midi = { state: "idle", names: [] } }) {
  let current = midi;
  let computerKeys = true;
  let attempted = false;
  let soundOn = readMidiSound(storage);

  const computerChip = el("span", { class: "chip input-chip", "data-input": "computer" });
  const midiChip = el("span", { class: "chip input-chip", "data-input": "midi", role: "status" });
  const button = el("button", { type: "button", class: "btn input-connect" });
  const hint = el("p", { class: "meta input-hint", role: "status" });
  const checkbox = el("input", { type: "checkbox", class: "input-midi-sound" });
  const soundText = el("span");
  const soundLabel = el("label", { class: "input-sound" }, checkbox, soundText);
  checkbox.checked = soundOn;
  const element = el("section", { class: "input-panel" }, el("div", { class: "input-row" }, computerChip, midiChip, button, soundLabel), hint);

  function render() {
    computerChip.textContent = i18n.t(computerKeys ? "input.computerKeys.on" : "input.computerKeys.off");
    midiChip.textContent = midiLine(i18n, current);
    midiChip.setAttribute("data-state", current.state);
    button.textContent = i18n.t("input.connect");
    button.hidden = !CAN_CONNECT.has(current.state);
    soundText.textContent = i18n.t("input.midiSound");
    const showHint = attempted && current.state === "no-device";
    hint.textContent = showHint ? i18n.t("input.midi.noDeviceHint") : "";
    hint.hidden = !showHint;
  }

  button.addEventListener("click", async () => {
    attempted = true;
    render();
    try {
      await connect();
    } catch {
      // the midi module reports its own state; a throw must not break the lesson
    }
    render();
  });
  checkbox.addEventListener("change", () => {
    soundOn = checkbox.checked === true;
    writeMidiSound(storage, soundOn);
  });
  const off = i18n.onChange(render);
  render();

  return {
    element,
    setMidiState(next) {
      current = next;
      render();
    },
    setComputerKeys(on) {
      computerKeys = on === true;
      render();
    },
    /** The setting for createLearnerSound: true when the app should sound MIDI notes too. */
    midiSound: () => soundOn,
    dispose() {
      off();
      element.remove();
    },
  };
}
