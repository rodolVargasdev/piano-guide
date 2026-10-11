// Pure helpers of the learn keyboard: how a key is named (spelled for the song's key, letter and solfege,
// in the order of the selected language) and how large everything is for a given width. No DOM.
import { isBlackKey } from "../core/keyboard-layout.js";
import { noteName, transpose } from "../core/pitch.js";

/** White keys never get narrower than this (learn-keyboard spec); fewer keys are shown instead. */
export const MIN_WHITE_PX = 36;
/** White keys never get wider than this: past it the keyboard stops growing and is centered. */
export const MAX_WHITE_PX = 88;
/** Length of a black key over a white key. Shorter than a real piano so a badge and the names fit below it. */
export const BLACK_RATIO = 0.56;

/** Spelled pitch of a MIDI key for a key context ({ tonic, mode }); sharps when there is no context. */
export function spellMidi(midi, key = null) {
  return transpose("C4", midi - 60, key);
}

/**
 * namesFor({ midi, key, pitch, lang }) -> { primary, secondary, letters, solfege }.
 * `pitch` is the spelling the data gives (E# in F# major) and wins over the key context. Without a
 * context, a black key shows both spellings ("C#/Db") because neither is more right than the other.
 * English puts the letter first, Spanish the solfege first; the note names themselves are the same.
 */
export function namesFor({ midi, key = null, pitch = null, lang = "en" }) {
  let letters;
  let solfege;
  if (!pitch && !key && isBlackKey(midi)) {
    const sharp = spellMidi(midi);
    const flat = transpose("C4", midi - 60, { tonic: "F", mode: "major" });
    letters = `${noteName(sharp, "letters")}/${noteName(flat, "letters")}`;
    solfege = `${noteName(sharp, "solfege")}/${noteName(flat, "solfege")}`;
  } else {
    const spelled = pitch ?? spellMidi(midi, key);
    letters = noteName(spelled, "letters") ?? "";
    solfege = noteName(spelled, "solfege") ?? "";
  }
  return lang === "es" ? { primary: solfege, secondary: letters, letters, solfege } : { primary: letters, secondary: solfege, letters, solfege };
}

// Sizes in CSS pixels per width class (learn-mode design, "Sizes by viewport"). Labels are never below 12.
const SIZES = {
  lg: { primary: 18, secondary: 14, badge: 30, badgeFont: 20, strip: 14, letter: 13 },
  md: { primary: 14, secondary: 12, badge: 24, badgeFont: 16, strip: 12, letter: 12 },
  sm: { primary: 13, secondary: 12, badge: 22, badgeFont: 15, strip: 12, letter: 12 },
};

/**
 * keyboardMetrics({ whiteCount, width, height }) -> sizes in pixels for a keyboard of `whiteCount` white
 * keys that must fit `width` (and `height` when given). The SVG is drawn in these pixels, so a font size
 * here is the size on screen. `size` is "lg" (wide white keys), "md" or "sm" (phone).
 */
export function keyboardMetrics({ whiteCount, width, height = Infinity }) {
  const keyW = Math.max(1, Math.floor(Math.min(width / Math.max(1, whiteCount), MAX_WHITE_PX)));
  const size = keyW >= 72 ? "lg" : keyW >= 52 ? "md" : "sm";
  const s = SIZES[size];
  const stripH = 2 * s.strip + 8; // two lines: letter and solfege of each black key
  const wanted = Math.round(keyW * 3.6);
  const keyH = Math.max(120, Math.min(wanted, Math.floor(height - stripH)));
  return { keyW, keyH, stripH, blackH: Math.round(keyH * BLACK_RATIO), size, ...s };
}
