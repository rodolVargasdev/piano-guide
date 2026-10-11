// Hand-authored SVG path data for the score. No font, no dependency.
//
// Units are staff spaces (1 = the distance between two staff lines) with y pointing down, so
// the renderer draws each glyph with transform="translate(x y) scale(unit)". Every glyph is
// { stroke, fill, w }: `stroke` is open path data drawn as an outline of width `w` (in staff
// spaces, round caps), `fill` is closed path data drawn solid. Either may be absent.
//
// Reference point of each glyph:
// - clefs: gClef on the G line, fClef on the F line (the staff is then y = -3..1 and y = -1..3)
// - accidentals: the line or space of the note (y = 0), centered on x = 0
// - rests: centered on x = 0; whole and half hang from or sit on the line at y = 0, quarter
//   and eighth are centered on the middle line
// - flags: the tip of the stem; ornaments: the center of the sign

const dot = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const FLAT = "M0 -2.8V0.6M0 0.6C1.7 -0.2 1.7 -1.9 0 -1.1";

export const GLYPHS = Object.freeze({
  gClef: {
    stroke: "M-0.6 2.5C-0.2 3.1 0.9 2.7 0.5 1.6L-0.3 -3.6C-0.5 -4.6 0.3 -5 0.8 -4.2C1.3 -3.3 0.3 -2.2 -0.9 -1.4C-2 -0.6 -1.9 0.9 -0.7 1.1C0.6 1.3 1.4 0.1 0.9 -0.7C0.4 -1.4 -0.7 -1.2 -0.7 -0.4",
    w: 0.2,
  },
  fClef: {
    stroke: "M-1.1 0C-1.1 -1.1 0.2 -1.2 0.7 -0.8C1.5 -0.1 1.2 1.6 -1.2 3.1",
    fill: `${dot(-1.1, 0, 0.42)}${dot(1.9, -0.5, 0.2)}${dot(1.9, 0.5, 0.2)}`,
    w: 0.22,
  },
  flat: { stroke: FLAT, w: 0.16 },
  "double-flat": { stroke: "M-0.5 -2.8V0.6M-0.5 0.6C0.9 -0.1 1 -1.7 -0.5 -1M0.4 -2.8V0.6M0.4 0.6C1.8 -0.1 1.9 -1.7 0.4 -1", w: 0.16 },
  sharp: { stroke: "M-0.35 -1.6V1.6M0.35 -1.8V1.4M-0.8 -0.45L0.8 -0.75M-0.8 0.75L0.8 0.45", w: 0.16 },
  natural: { stroke: "M-0.4 -1.6V0.7M0.4 -0.7V1.6M-0.4 0.7L0.4 0.45M-0.4 -0.45L0.4 -0.7", w: 0.16 },
  "double-sharp": { stroke: "M-0.55 -0.55L0.55 0.55M-0.55 0.55L0.55 -0.55", w: 0.32 },
  restWhole: { fill: "M-0.7 0h1.4v0.5h-1.4z" },
  restHalf: { fill: "M-0.7 -0.5h1.4v0.5h-1.4z" },
  restQuarter: { stroke: "M0.4 -1.7L-0.4 -0.7L0.4 0.3L-0.3 1.1C-0.9 1.7 0.1 2 0.4 1.4", w: 0.22 },
  restEighth: { stroke: "M-0.3 -0.3C0.2 -0.3 0.5 -0.6 0.7 -1L-0.4 1.6", fill: dot(-0.35, -0.35, 0.3), w: 0.18 },
  flagUp: { stroke: "M0 0C0.1 1.2 1.3 1.6 1.1 3.2", w: 0.28 },
  flagDown: { stroke: "M0 0C0.1 -1.2 1.3 -1.6 1.1 -3.2", w: 0.28 },
  turn: { stroke: "M-1.5 0.2C-1.5 -0.8 -0.5 -0.9 0 -0.2C0.5 0.5 1.5 0.8 1.5 -0.2C1.5 -0.7 0.9 -0.7 0.5 -0.2", w: 0.16 },
  mordent: { stroke: "M-1.2 0L-0.8 -0.8L-0.4 0L0 -0.8L0.4 0L0.8 -0.8L1.2 0M0 -1.3V0.5", w: 0.16 },
  "inverted-mordent": { stroke: "M-1.2 0L-0.8 -0.8L-0.4 0L0 -0.8L0.4 0L0.8 -0.8L1.2 0", w: 0.16 },
});

/** Names of the accidentals the layout can produce, all of which have a glyph. */
export const ACCIDENTAL_GLYPHS = ["flat", "double-flat", "sharp", "natural", "double-sharp"];

/** The glyph for a rest of the given written value ("whole", "half", "quarter", "eighth", "16th", "32nd"). */
export function restGlyph(base) {
  return { whole: "restWhole", half: "restHalf", quarter: "restQuarter" }[base] ?? "restEighth";
}

/** Number of stacked eighth-rest hooks for a rest value: 1 for an eighth, 2 for a 16th, 3 for a 32nd. */
export function restHooks(base) {
  return { eighth: 1, "16th": 2, "32nd": 3 }[base] ?? 0;
}

/** A wavy line of the given width (staff spaces) starting at the origin, used after "tr". */
export function waveLine(width) {
  const cycles = Math.max(1, Math.round(width / 1.6));
  return `M0 0${"q0.4 -0.6 0.8 0q0.4 0.6 0.8 0".repeat(cycles)}`;
}

/** A square bracket of the given width opening downward, used for the fioritura. */
export function bracketPath(width) {
  return `M0 0.5V0H${width}V0.5`;
}
