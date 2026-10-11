// Hand-authored SVG path data for the score. No font, no dependency.
//
// Units are staff spaces (1 = the distance between two staff lines) with y pointing down, so
// the renderer draws each glyph with transform="translate(x y) scale(unit)". Every glyph is
// { strokes, fill }: `strokes` is a list of [path, width] pairs, each open path data drawn as an
// outline of that width (in staff spaces, round caps and joins, so a thick and a thin stroke
// meeting at a point read as one calligraphic line); `fill` is closed path data drawn solid.
// Either may be absent. Closed shapes are wound clockwise, and a counter (the hole of a flat)
// is wound the other way, because the stylesheet fills with the non-zero rule.
//
// Reference point of each glyph:
// - clefs: gClef on the G line, fClef on the F line (the staff is then y = -3..1 and y = -1..3)
// - accidentals: the line or space of the note (y = 0), centered on x = 0
// - rests: centered on x = 0; whole and half hang from or sit on the line at y = 0, quarter
//   and eighth are centered on the middle line
// - flags: the tip of the stem; ornaments: the center of the sign

const dot = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const num = (v) => Math.round(v * 1000) / 1000;

// A flat: a thin stem and a rounded bowl, one outline with the bowl's counter cut out by a second
// outline wound the other way. `dx` slides it sideways for the double flat.
const flat = (dx = 0) => {
  const x = (v) => num(v + dx);
  return `M${x(-0.46)} -2.7H${x(-0.31)}V-0.7C${x(0.05)} -1 ${x(0.85)} -0.9 ${x(0.85)} -0.15C${x(0.85)} 0.35 ${x(0.3)} 0.8 ${x(-0.46)} 0.66zM${x(-0.31)} 0.4C${x(0.2)} 0.3 ${x(0.52)} 0.05 ${x(0.52)} -0.2C${x(0.52)} -0.52 ${x(0.12)} -0.55 ${x(-0.31)} -0.3z`;
};

// Straight-edged parts (sharp, natural) are polygons: a list of [x, y] corners per closed shape.
const poly = (...shapes) => shapes.map((s) => `M${s.map(([x, y]) => `${x} ${y}`).join("L")}z`).join("");

export const GLYPHS = Object.freeze({
  // The G clef as one calligraphic line: a hairline curl inside the loop around the G line, the
  // loop, the tall left lobe, the top, then a heavier spine down to a ball below the staff.
  gClef: {
    // Widths change in small steps from one curve to the next, so no junction shows a bump.
    strokes: [
      ["M0.12 -0.5C-0.45 -0.8 -1.25 -0.3 -1.12 0.55", 0.12],
      ["M-1.12 0.55C-0.98 1.4 0.35 1.6 1.08 0.85", 0.15],
      ["M1.08 0.85C1.65 0.2 1.2 -1 0.15 -1.65", 0.17],
      ["M0.15 -1.65C-0.75 -2.3 -1.1 -3.3 -0.65 -4", 0.19],
      ["M-0.65 -4C-0.25 -4.6 0.5 -4.45 0.55 -3.6", 0.21],
      ["M0.55 -3.6C0.6 -2.7 0.28 -0.6 0.22 0.5", 0.23],
      ["M0.22 0.5L0.14 2", 0.21],
      ["M0.14 2C0.1 2.7 -0.45 2.85 -0.6 2.5", 0.19],
    ],
    fill: dot(-0.6, 2.5, 0.28),
  },
  // The F clef: the ball on the F line, one arc over the top that thickens on the right and
  // tapers to the lowest line, and the two dots in the spaces either side of the F line.
  fClef: {
    strokes: [
      ["M-1.05 0.05C-1.05 -0.95 0.1 -1.3 0.8 -0.7", 0.19],
      ["M0.8 -0.7C1.55 -0.05 1.3 1.5 -0.1 2.4", 0.24],
      ["M-0.1 2.4C-0.6 2.7 -1.1 2.9 -1.4 3.15", 0.17],
    ],
    fill: `${dot(-1.05, 0.05, 0.4)}${dot(1.95, -0.5, 0.21)}${dot(1.95, 0.5, 0.21)}`,
  },
  flat: { fill: flat() },
  "double-flat": { fill: flat(-0.5) + flat(0.5) },
  // Two thin stems and two thick bars rising to the right.
  sharp: {
    fill: poly(
      [[-0.38, -1.5], [-0.26, -1.5], [-0.26, 1.7], [-0.38, 1.7]],
      [[0.26, -1.7], [0.38, -1.7], [0.38, 1.5], [0.26, 1.5]],
      [[-0.62, 0.62], [0.62, 0.2], [0.62, 0.52], [-0.62, 0.94]],
      [[-0.62, -0.32], [0.62, -0.74], [0.62, -0.42], [-0.62, 0]],
    ),
  },
  // A tall left stem, a tall right stem and two bars rising to the right between them.
  natural: {
    fill: poly(
      [[-0.4, -1.6], [-0.28, -1.6], [-0.28, 0.62], [-0.4, 0.62]],
      [[0.28, -0.62], [0.4, -0.62], [0.4, 1.6], [0.28, 1.6]],
      [[-0.4, -0.42], [0.4, -0.7], [0.4, -0.38], [-0.4, -0.1]],
      [[-0.4, 0.3], [0.4, 0.02], [0.4, 0.34], [-0.4, 0.62]],
    ),
  },
  "double-sharp": {
    strokes: [["M-0.5 -0.5L0.5 0.5M-0.5 0.5L0.5 -0.5", 0.14]],
    fill: poly([[-0.72, -0.72], [-0.28, -0.72], [-0.28, -0.28], [-0.72, -0.28]], [[0.28, -0.72], [0.72, -0.72], [0.72, -0.28], [0.28, -0.28]], [[-0.72, 0.28], [-0.28, 0.28], [-0.28, 0.72], [-0.72, 0.72]], [[0.28, 0.28], [0.72, 0.28], [0.72, 0.72], [0.28, 0.72]]),
  },
  restWhole: { fill: "M-0.7 0h1.4v0.5h-1.4z" },
  restHalf: { fill: "M-0.7 -0.5h1.4v0.5h-1.4z" },
  // The quarter rest: a slanted top, a heavy bend through the middle, then a curl at the foot.
  restQuarter: {
    strokes: [
      ["M-0.22 -1.5L0.34 -0.72", 0.28],
      ["M0.32 -0.68L-0.08 0.14", 0.44],
      ["M-0.1 0.3C0.5 0.38 0.58 0.9 0.2 1.18", 0.32],
      ["M0.2 1.18C-0.2 1.4 -0.34 1.6 -0.1 1.72", 0.22],
    ],
    fill: dot(-0.12, 1.66, 0.2),
  },
  // The eighth rest: a ball, a leaf-shaped hook and a long slanted stem.
  restEighth: {
    strokes: [
      ["M-0.38 -0.32C0 -0.18 0.38 -0.4 0.55 -0.95", 0.2],
      ["M0.53 -0.95L-0.24 1.55", 0.17],
    ],
    fill: dot(-0.42, -0.32, 0.31),
  },
  flagUp: { fill: "M-0.07 0H0.08C0.2 0.8 1.2 1.3 1.1 2.95C0.92 2.25 0.45 1.8 0.08 1.65V1.15H-0.07z" },
  flagDown: { fill: "M-0.07 0H0.08C0.2 -0.8 1.2 -1.3 1.1 -2.95C0.92 -2.25 0.45 -1.8 0.08 -1.65V-1.15H-0.07z" },
  // The turn: a hook rising on the left, a long diagonal through the middle, a hook falling on the right.
  turn: { strokes: [["M-1.45 0.28C-1.6 -0.55 -0.7 -0.8 -0.1 -0.2C0.5 0.4 1.1 0.75 1.5 0.35C1.8 0 1.5 -0.6 0.95 -0.45", 0.15]] },
  mordent: { strokes: [["M-1.3 0.32L-0.88 -0.34L-0.44 0.32L0 -0.34L0.44 0.32L0.88 -0.34L1.3 0.32M0 -1.25V0.7", 0.14]] },
  "inverted-mordent": { strokes: [["M-1.3 0.32L-0.88 -0.34L-0.44 0.32L0 -0.34L0.44 0.32L0.88 -0.34L1.3 0.32", 0.14]] },
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
