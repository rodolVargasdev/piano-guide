// The "Today" card at the top of the practice list: what today's 10-minute routine holds, the key of the day on a
// circle of fifths, the days in a row and how the learner is doing in that key. It reads only the saved progress and the
// date; the routine itself is built by practice/routine.js. Text goes through text nodes only.
import { buildRoutine } from "../practice/routine.js";
import { entryOf } from "../practice/progress.js";
import { createCircleOfFifths } from "./circle-of-fifths.js";
import { el } from "./dom.js";
import { summaryChips } from "./practice-doc.js";
import { introModel } from "./practice-routine.js";

/**
 * todayModel({ progress, today, i18n }) -> the card as plain data, or null for a date that is not a day:
 * { heading, sub, lines, total, streak, doneToday, keyLine, key, doneKeys, chips }. `key` is the key of today's scale,
 * `doneKeys` the keys with a clean scale run, `chips` the progress in today's key (best tempo, clean streak, runs).
 */
export function todayModel({ progress, today, i18n }) {
  const routine = buildRoutine(progress, today);
  if (!routine) return null;
  const t = i18n.t;
  const intro = introModel({ routine, progress, today, i18n });
  const key = routine.blocks[1].key;
  const entry = entryOf(progress, "scale-major", key);
  return {
    heading: t("routine.today"),
    sub: intro.heading,
    lines: intro.lines,
    total: intro.total,
    streak: intro.streak,
    doneToday: intro.doneToday,
    keyLine: t("routine.todayKey", { key: t("key.major", { tonic: key }) }),
    key,
    // Practiced keys: a clean scale run on its own page, or a scale block the routine ended with.
    doneKeys: [...new Set([...Object.entries(progress.exercises["scale-major"] ?? {}).filter(([, e]) => e.cleanRuns > 0).map(([k]) => k), ...Object.keys(progress.routine.scaleLastPracticed)])],
    chips: entry ? summaryChips({ keys: 1, ...entry }, t) : [],
  };
}

/**
 * createTodayCard({ i18n }) -> { element, set({ progress, today }), dispose() }. `set` redraws the card for a progress
 * and a day (and on every language change); a bad date leaves the card hidden.
 */
export function createTodayCard({ i18n }) {
  const t = i18n.t;
  const circle = createCircleOfFifths({ i18n, readOnly: true });
  const element = el("section", { class: "practice-today", "aria-label": t("routine.today") });
  let last = null;

  function draw() {
    const m = last && todayModel({ ...last, i18n });
    element.hidden = !m;
    if (!m) return element.replaceChildren();
    circle.set({ current: m.key, done: m.doneKeys, next: [] });
    const facts = [m.total, m.streak, m.doneToday].filter(Boolean).join(" | ");
    element.replaceChildren(
      el(
        "div",
        { class: "practice-today-text" },
        el("p", { class: "practice-today-label" }, m.heading),
        el("h3", { class: "practice-today-title" }, m.sub),
        el("ol", { class: "routine-list" }, m.lines.map((l) => el("li", {}, l))),
        el("p", { class: "meta" }, facts),
        el("p", { class: "meta practice-today-key" }, m.keyLine),
        ...(m.chips.length > 0 ? [el("p", { class: "chips" }, m.chips.map((c) => el("span", { class: "chip" }, c)))] : []),
        el("a", { class: "button practice-today-start", href: "#/practice/routine" }, t("routine.start")),
      ),
      circle.element,
    );
  }
  const off = i18n.onChange(draw);
  return {
    element,
    set(next) {
      last = next;
      draw();
    },
    dispose() {
      off();
      circle.dispose();
      element.remove();
    },
  };
}
