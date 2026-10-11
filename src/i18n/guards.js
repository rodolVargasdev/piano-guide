// Pure guards over a string table ({ key: { en, es } }). Each returns a list of findings (empty
// when the table is clean), so a test can run it on the real catalog and on a fixture with one
// defect that it must flag. No DOM, no dependency.

const LANGUAGES = ["en", "es"];
const filled = (v) => typeof v === "string" && v.trim() !== "";

/** Characters that mark text as machine-written: typographic dashes, curly quotes, ellipsis, arrows, bullets. */
export const FORBIDDEN_CHARS = [0x2014, 0x2013, 0x00b7, 0x2026, 0x201c, 0x201d, 0x2018, 0x2019, 0x2192, 0x2022, 0x00a0].map((codePoint) => String.fromCodePoint(codePoint));

/** Second-person-singular voseo forms the Spanish text must never use (whole words, any case). */
export const VOSEO_WORDS = ["vos", "podés", "tenés", "querés", "sabés", "mirá", "tocá", "presioná", "poné", "dejá", "escribí", "hacé", "fijate", "acá", "pulsá", "apretá", "usá", "elegí", "seleccioná"];

const VOSEO_RE = new RegExp(`(?<![\\p{L}])(?:${VOSEO_WORDS.join("|")})(?![\\p{L}])`, "iu");
const placeholdersOf = (text) => [...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(",");

/** Keys that lack a non-empty English or Spanish value. */
export function missingTranslations(table) {
  return Object.entries(table).filter(([, v]) => !LANGUAGES.every((lang) => filled(v?.[lang]))).map(([key]) => key);
}

/** Keys whose `{placeholder}` set differs between English and Spanish. */
export function placeholderMismatches(table) {
  return Object.entries(table)
    .filter(([, v]) => filled(v?.en) && filled(v?.es) && placeholdersOf(v.en) !== placeholdersOf(v.es))
    .map(([key]) => key);
}

/** "key.lang U+XXXX" for every forbidden character found in a value. */
export function forbiddenTypography(table) {
  const found = [];
  for (const [key, v] of Object.entries(table)) {
    for (const lang of LANGUAGES) {
      for (const ch of FORBIDDEN_CHARS) {
        if (typeof v?.[lang] === "string" && v[lang].includes(ch)) found.push(`${key}.${lang} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
      }
    }
  }
  return found;
}

/** Keys whose Spanish text uses a voseo form. */
export function voseoForms(table) {
  return Object.entries(table).filter(([, v]) => typeof v?.es === "string" && VOSEO_RE.test(v.es)).map(([key]) => key);
}

/** Sentences in a text: runs ended by . ! or ? (a final sentence without a mark counts too). */
export function countSentences(text) {
  return String(text).split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim() !== "").length;
}

/** Words in a text, split on whitespace. */
export function countWords(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

/**
 * `render({ lang, hand, finger, count, move })` returns one instruction text. Enumerates every hand,
 * finger 1 to 5, count 1 to 5, move or not, in both languages, and lists each that has more than two
 * sentences or more than 25 words.
 */
export function instructionLimits(render, { maxSentences = 2, maxWords = 25 } = {}) {
  const over = [];
  for (const lang of LANGUAGES) {
    for (const hand of ["R", "L"]) {
      for (let finger = 1; finger <= 5; finger += 1) {
        for (let count = 1; count <= 5; count += 1) {
          for (const move of [false, true]) {
            const text = render({ lang, hand, finger, count, move });
            const sentences = countSentences(text);
            const words = countWords(text);
            if (sentences > maxSentences || words > maxWords) over.push(`${lang} ${hand} finger ${finger} count ${count} move ${move}: ${sentences} sentences, ${words} words`);
          }
        }
      }
    }
  }
  return over;
}
