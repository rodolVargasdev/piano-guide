// Lazy AudioContext. Browsers block audio until a user gesture, so the context is
// created and resumed inside the Play click handler (engine.play calls ensure()
// synchronously). Leaving the player suspends it instead of closing it.

export function createAudio({ AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  let ctx = null;
  return {
    /** The context, created on first use and resumed when suspended. Call inside a user gesture. */
    ensure() {
      if (!ctx) {
        if (!AudioContextCtor) throw new Error("Web Audio is not available in this browser");
        ctx = new AudioContextCtor({ latencyHint: "interactive" });
      }
      if (ctx.state === "suspended") ctx.resume()?.catch?.(() => {});
      return ctx;
    },
    /** The context if it exists, otherwise null. */
    get context() {
      return ctx;
    },
    /** Seconds between scheduling a sound and hearing it (0 when unknown). */
    outputLatency() {
      return ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0;
    },
    /** Suspend while the player is not on screen; ensure() resumes it. */
    suspend() {
      if (ctx && ctx.state === "running") ctx.suspend()?.catch?.(() => {});
    },
  };
}
