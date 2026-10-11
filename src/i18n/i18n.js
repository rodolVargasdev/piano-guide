// Learner language: a tiny synchronous translator with no dependency. The table is injected
// ({ key: { en, es } }, plural keys written key_one and key_other), so the same code serves the
// real catalog (src/i18n/strings.js) and the fixture tables of the tests.

export const LANG_KEY = "piano-guide:lang";
const LANGUAGES = ["en", "es"];
const filled = (v) => typeof v === "string" && v.trim() !== "";

/** The saved choice wins; else Spanish when the browser language starts with `es`; else English. */
export function pickLanguage(saved, navigatorLanguage) {
  if (LANGUAGES.includes(saved)) return saved;
  return typeof navigatorLanguage === "string" && /^es([-_]|$)/i.test(navigatorLanguage.trim()) ? "es" : "en";
}

/** Replaces each {name} with its parameter; a placeholder without a parameter is left visible. */
export function format(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}

/**
 * createI18n({ storage, navigatorLanguage, documentElement, table, warn }) ->
 *   { t(key, params), lang(), setLang(lang), onChange(fn) }.
 * `t` picks the plural form when `params.count` is a number and `key_one` or `key_other` exists, falls
 * back to English when the language has no text, and never returns a raw key: an unknown key gives an
 * empty string and a warning for development.
 */
export function createI18n({ storage, navigatorLanguage, documentElement, table = {}, warn = (message) => console.warn(message) } = {}) {
  let saved = null;
  try {
    saved = storage?.getItem(LANG_KEY) ?? null;
  } catch {
    saved = null; // blocked storage: the browser language decides
  }
  let current = pickLanguage(saved, navigatorLanguage);
  const listeners = new Set();
  const apply = () => {
    if (documentElement) documentElement.lang = current;
  };
  apply();

  function entryFor(key, params) {
    if (params && typeof params.count === "number") {
      const plural = table[`${key}_${params.count === 1 ? "one" : "other"}`];
      if (plural) return plural;
    }
    return table[key];
  }

  return {
    t(key, params) {
      const entry = entryFor(key, params);
      const text = entry && (filled(entry[current]) ? entry[current] : filled(entry.en) ? entry.en : "");
      if (!text) {
        warn(`i18n: no text for "${key}"`);
        return "";
      }
      return format(text, params);
    },
    lang: () => current,
    /** Changes the language at once for the session; the choice is saved when storage allows it. */
    setLang(lang) {
      if (!LANGUAGES.includes(lang) || lang === current) return current;
      current = lang;
      try {
        storage?.setItem(LANG_KEY, lang);
      } catch {
        // blocked storage: the page still switches for this session, with no error shown
      }
      apply();
      for (const fn of [...listeners]) fn(current);
      return current;
    },
    /** Subscribe to language changes (called synchronously). Returns the unsubscribe function. */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
