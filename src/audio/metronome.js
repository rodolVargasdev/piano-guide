// Metronome clicks: 30 ms sine bursts. The engine decides WHEN (from core beatGrid and
// the effective BPM); this module only makes the sound and cancels clicks that have not played.

export const ACCENT_HZ = 1500;
export const CLICK_HZ = 1000;
export const SUB_HZ = 800;
const BURST = 0.03;

export function createMetronome(ctx, { destination = ctx.destination } = {}) {
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(destination);
  let pending = []; // { start, end, osc }

  return {
    /** One click at audio time `when`. `accent` is the bar downbeat; `sub` a quieter subdivision click. */
    click(when, { accent = false, sub = false } = {}) {
      const now = ctx.currentTime;
      pending = pending.filter((c) => c.end > now);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = accent ? ACCENT_HZ : sub ? SUB_HZ : CLICK_HZ;
      const env = ctx.createGain();
      const level = accent ? 1 : sub ? 0.35 : 0.7;
      env.gain.setValueAtTime(level, when);
      env.gain.exponentialRampToValueAtTime(0.001, when + BURST);
      osc.connect(env);
      env.connect(out);
      osc.start(when);
      osc.stop(when + BURST + 0.005);
      pending.push({ start: when, end: when + BURST + 0.005, osc });
    },

    /** Drop clicks that have not started yet (seek, pause, tempo change). */
    cancelPending(now = ctx.currentTime) {
      for (const c of pending) if (c.start > now) c.osc.stop(now);
      pending = pending.filter((c) => c.start <= now && c.end > now);
    },

    dispose() {
      this.cancelPending();
      out.disconnect();
    },
  };
}
