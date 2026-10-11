// Seeded randomness for the theory generators: the same seed always gives the same sequence, so
// every generator that uses chance can be tested and every ear-drill question can be reproduced.

/** mulberry32(seed) returns a function giving floats in [0, 1) from a 32-bit seed. */
export function mulberry32(seed) {
  let state = Number(seed) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new array with the items of `list` in a random order (Fisher-Yates); `list` is not changed. */
export function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
