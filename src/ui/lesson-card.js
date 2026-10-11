// Lesson card: the written guide of a song and level. Everything comes from the song file and
// goes into the page through the el() helper (text nodes only, never markup). The card has no
// transitions or animations at all, so it already swaps instantly under reduced motion.

import { el } from "./dom.js";
import { barBeatOf } from "../core/timing.js";
import { parseChord, chordMidis } from "../core/chords.js";
import { textOf } from "../core/text.js";

const CHORD_OCTAVE = 3; // chords are lit in the octave where they fit the fitted keyboard range
const HAND_WORD = { L: "left hand", R: "right hand" };
const CONFIDENCE_LABEL = { high: "High confidence", medium: "Medium confidence", low: "Lower confidence" };

/** "Bar 3", or "Pickup" for the bar before the first full bar. */
export function barLabel(tick, song) {
  const { bar } = barBeatOf(tick, song.meter, song.pickupTicks, song.tempo.beatUnit);
  return bar === 0 ? "Pickup" : `Bar ${bar}`;
}

/** The URL when it is a valid https: address, otherwise null (javascript:, data:, http: and garbage never become links). */
export function safeHttpsUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Text of a confidence level; anything unknown reads as lower confidence. */
export const confidenceLabel = (level) => CONFIDENCE_LABEL[level] ?? CONFIDENCE_LABEL.low;

const section = (title, ...body) => el("section", { class: "lesson-section" }, el("h3", {}, title), ...body);
const list = (tag, items) => el(tag, {}, items.map((text) => el("li", {}, text)));

/**
 * createLessonCard({ song, onHighlight, lang }) returns { element, setLevel(levelId, { analysis }), setLang(lang), dispose() }.
 * `onHighlight(midis)` is called with the keys of the chosen chord chip, and with [] to clear them.
 * Song texts (summary, posture, analysis title and text) are plain strings (English) or LocalizedText;
 * `lang` ("en" by default) picks the language, with English as the fallback. `setLang` draws the
 * shown level again in the new language (a chord outline is cleared by the redraw).
 */
export function createLessonCard({ song, onHighlight = () => {}, lang = "en" }) {
  const element = el("section", { class: "lesson", "aria-label": "Lesson" });
  let selected = null;
  let currentLang = lang;
  let shown = null; // { levelId, options } of the level on screen
  const detail = el("output", { class: "meta chord-detail", role: "status" });

  function choose(symbol, chip, chips) {
    const same = selected === symbol;
    selected = same ? null : symbol;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(!same && c === chip)));
    const chord = same ? null : parseChord(symbol, CHORD_OCTAVE);
    detail.textContent = chord ? `${symbol}: ${chord.names.join(" ")}${chord.bass ? `, bass ${chord.bass}` : ""}` : "";
    onHighlight(chord ? chordMidis(symbol, CHORD_OCTAVE) : []);
  }

  function chordsSection(lesson) {
    const chips = [];
    const nodes = lesson.chordsUsed.map((symbol) => {
      if (!parseChord(symbol)) return el("span", { class: "chip", title: "No notes available for this symbol" }, String(symbol));
      const chip = el("button", { type: "button", class: "btn chord-chip", "aria-pressed": "false", title: "Show these notes on the keyboard" }, String(symbol));
      chip.addEventListener("click", () => choose(symbol, chip, chips));
      chips.push(chip);
      return chip;
    });
    const lower = (song.confidence ?? []).filter((c) => String(c.scope).startsWith("chords") && c.level === "low");
    return section("Chords", el("div", { class: "chips" }, nodes), detail, lower.map((c) => el("p", { class: "meta low" }, `${confidenceLabel(c.level)}: ${c.note}`)));
  }

  function analysisSection(entries) {
    return section(
      "Analysis",
      el("ul", {}, entries.map((a) => el("li", {}, `${barLabel(a.tick, song)}, ${textOf(a.title, currentLang)}${a.roman ? ` (${a.roman}${a.function ? `, ${a.function}` : ""})` : ""}: ${textOf(a.text, currentLang)}`))),
    );
  }

  function sourcesSection() {
    const items = (song.sources ?? []).map((s) => {
      const href = safeHttpsUrl(s.url);
      return el("li", {}, href ? el("a", { href, rel: "noopener noreferrer" }, href) : el("span", {}, String(s.url)), ` ${s.what}`);
    });
    return section("Sources", el("ul", {}, items));
  }

  function confidenceSection() {
    return section("Confidence", el("ul", {}, (song.confidence ?? []).map((c) => el("li", { class: c.level === "low" ? "low" : "" }, `${confidenceLabel(c.level)}, ${c.scope}: ${c.note}`))));
  }

  /** Draws the lesson of `levelId`; `analysis` shows or hides the analysis section. Clears any chord outline. */
  function setLevel(levelId, { analysis = false } = {}) {
    shown = { levelId, options: { analysis } };
    if (selected !== null) onHighlight([]);
    selected = null;
    detail.textContent = "";
    const lesson = song.lesson?.[levelId];
    if (!lesson) {
      element.replaceChildren(el("p", { class: "meta", role: "status" }, "No lesson for this level yet"));
      return;
    }
    const entries = song.levels?.[levelId]?.analysis ?? [];
    element.replaceChildren(
      el("h2", {}, "Lesson"),
      el(
        "div",
        { class: "lesson-body" },
        section("Overview", el("p", {}, textOf(lesson.summary, currentLang))),
        chordsSection(lesson),
        section("Hands", list("ul", lesson.handPositions.map((h) => `${barLabel(h.tick, song)}, ${HAND_WORD[h.hand] ?? h.hand}: start on ${h.anchor}. ${h.text}`))),
        section("How to sit", el("p", {}, textOf(lesson.posture, currentLang))),
        section("Practice plan", list("ol", lesson.practicePlan)),
        lesson.arrangementNote && section("Arrangement", el("p", {}, lesson.arrangementNote)),
        lesson.interpretation && section("Interpretation", el("p", {}, `Rubato: ${lesson.interpretation.rubato}`), el("p", {}, `Dynamics: ${lesson.interpretation.dynamics}`)),
        lesson.ornaments?.length > 0 && section("Ornaments", list("ul", lesson.ornaments.map((o) => `${barLabel(o.tick, song)}, ${o.name}: ${o.text}`))),
        analysis && entries.length > 0 && analysisSection(entries),
        sourcesSection(),
        confidenceSection(),
      ),
    );
  }

  return {
    element,
    setLevel,
    setLang(next) {
      currentLang = next;
      if (shown) setLevel(shown.levelId, shown.options);
    },
    dispose() {
      if (selected !== null) onHighlight([]);
      selected = null;
      element.remove();
    },
  };
}
