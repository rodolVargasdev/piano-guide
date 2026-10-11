// Shared scene constants. Plain numbers and strings only: no three.js import, so they are
// testable under node and usable by every scene module.
//
// World axes: x runs along the keyboard (centered on 0), y is up, z points at the player.
// The keybed top is y = 0. The back edge of every key is z = 0 and the front edge is z > 0.
// The falling-note wall stands at the back edge and rises from the key-top line.

export const WHITE_LENGTH = 6.4; // 150 mm over a 23.5 mm key width
export const BLACK_LENGTH = 4.0;
export const WHITE_TOP = 0.8;
export const BLACK_TOP = 1.4;
export const BLACK_HEIGHT = 0.95;
export const KEY_GAP = 0.06; // drawn white keys are this much narrower than their slot
export const PRESS_ANGLE = 0.055; // radians, front of a white key moves down about 0.35 units
export const BLACK_PRESS_ANGLE = 0.06;

/** The line where a note's lower edge meets its key; the wall of falling notes rises from here. */
export const LANDING_Y = BLACK_TOP;
export const WALL_HEIGHT = 6.5; // visible look-ahead, equal to 2 bars by default

export const BACKGROUND = "#0b0d12";

/** Hand colors: left blue, right orange. */
export const HAND_COLOR = Object.freeze({ L: "#3b82f6", R: "#f59e0b" });
export const KEY_REST_COLOR = Object.freeze({ white: "#efe9dd", black: "#16181e" });
