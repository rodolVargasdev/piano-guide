// Pure helpers for learner-facing song text. A text value is a plain string (read as
// English) or a LocalizedText object { en, es } with both languages non-empty.

const filled = (v) => typeof v === "string" && v.trim() !== "";

/** True for a LocalizedText: a plain object with a non-empty `en` and a non-empty `es`. */
export function isLocalizedText(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && filled(v.en) && filled(v.es);
}

/**
 * The string to show for `lang` ("en" or "es"). A plain string is English text and is returned
 * for every language; a LocalizedText returns `value[lang]`, falling back to English when that
 * language is missing or empty. Anything else gives an empty string.
 */
export function textOf(value, lang) {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "";
  return filled(value[lang]) ? value[lang] : filled(value.en) ? value.en : "";
}
