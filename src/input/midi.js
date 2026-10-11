// Web MIDI input. Permission is asked only from connect() (a click), every input is listened to, and
// devices plugged or unplugged later are followed without a reload. The bus gets note events with the
// source "midi"; everything that is not a note is ignored. No dependency, no DOM.

/**
 * parseMidiMessage(bytes) -> { type: "on" | "off", midi, velocity } | null. Note-on with velocity 0 is a
 * release; velocity is scaled to 0..1. Pedal, clock, sensing, short or malformed messages give null.
 */
export function parseMidiMessage(bytes) {
  if (!bytes || bytes.length < 3) return null;
  const [status, midi, velocity] = bytes;
  if (!(midi >= 0 && midi <= 127 && velocity >= 0 && velocity <= 127)) return null;
  const kind = status & 0xf0;
  if (kind === 0x80 || (kind === 0x90 && velocity === 0)) return { type: "off", midi, velocity: 0 };
  if (kind === 0x90) return { type: "on", midi, velocity: velocity / 127 };
  return null;
}

/** The device name with its manufacturer in front, unless the name already says it. */
export function deviceName(port) {
  const name = String(port?.name ?? "").trim();
  const maker = String(port?.manufacturer ?? "").trim();
  if (maker && !name.toLowerCase().includes(maker.toLowerCase())) return `${maker} ${name}`.trim();
  return name || maker || "MIDI input";
}

const DENIED = ["SecurityError", "NotAllowedError"];

/**
 * createMidiInput({ navigator, isSecureContext, bus, onState }) -> { connect, state, names, dispose }.
 * States: unsupported | insecure | idle | requesting | denied | no-device | connected | unavailable.
 * `onState({ state, names })` runs on every change. connect() is the only place permission is requested
 * and may be pressed again (to retry or to rescan). A disconnect releases the held "midi" notes.
 */
export function createMidiInput({ navigator, isSecureContext, bus, onState = () => {} }) {
  let current = isSecureContext === false ? "insecure" : typeof navigator?.requestMIDIAccess === "function" ? "idle" : "unsupported";
  let names = [];
  let access = null;
  let pending = null;
  let disposed = false;
  const listened = new Map(); // port -> handler

  const set = (state) => {
    current = state;
    onState({ state, names: [...names] });
  };

  const handler = (event) => {
    const msg = parseMidiMessage(event.data);
    if (!msg) return;
    if (msg.type === "on") bus.noteOn(msg.midi, { source: "midi", velocity: msg.velocity });
    else bus.noteOff(msg.midi, { source: "midi" });
  };

  // Listens to every connected input, forgets the ones that went away, and sets the state from what is left.
  function rescan() {
    const ports = [...access.inputs.values()].filter((p) => p.state === undefined || p.state === "connected");
    let lost = false;
    for (const [port] of listened) {
      if (!ports.includes(port)) {
        port.onmidimessage = null;
        listened.delete(port);
        lost = true;
      }
    }
    for (const port of ports) {
      if (!listened.has(port)) {
        port.onmidimessage = handler;
        listened.set(port, handler);
      }
    }
    if (lost) bus.releaseAll("midi"); // a cable pulled mid-note must not leave a note stuck
    names = ports.map(deviceName);
    set(ports.length > 0 ? "connected" : "no-device");
  }

  async function request() {
    set("requesting");
    try {
      const granted = await navigator.requestMIDIAccess({ sysex: false });
      if (disposed) return;
      access = granted;
      access.onstatechange = () => {
        if (!disposed) rescan();
      };
      rescan();
    } catch (error) {
      if (disposed) return;
      names = [];
      set(DENIED.includes(error?.name) ? "denied" : "unavailable");
    } finally {
      pending = null;
    }
  }

  return {
    /** Asks for permission (from a click only). Resolves with the state it reached. */
    async connect() {
      if (disposed || current === "unsupported" || current === "insecure") return current;
      if (pending) return pending.then(() => current);
      if (access) {
        rescan();
        return current;
      }
      pending = request();
      await pending;
      return current;
    },
    state: () => current,
    names: () => [...names],
    dispose() {
      disposed = true;
      for (const [port] of listened) port.onmidimessage = null;
      listened.clear();
      if (access) access.onstatechange = null;
      bus.releaseAll("midi");
    },
  };
}
