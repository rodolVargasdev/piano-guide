// Practice view: the list of exercises (#/practice) and the doc card of one exercise (#/practice/<id>).
// What each screen says is plain data (`listModel`, `cardModel`) so it is testable without a DOM; the view turns it
// into elements with text nodes only. The id in the address bar is only compared against the catalog and is never
// shown. The page follows the language selector and keeps its place when the language changes.
import { GROUPS, exerciseById, exercisesIn } from "../practice/catalog.js";
import { clearPracticeProgress, localIsoDate, readPracticeProgress, summaryOf } from "../practice/progress.js";
import { el } from "./dom.js";
import { cardModel, docArticle, summaryChips } from "./practice-doc.js";
import { createEarPage } from "./practice-ear.js";
import { createRoutinePage } from "./practice-routine.js";
import { createTodayCard } from "./practice-today.js";
import { createExercisePage } from "./practice-run.js";

export { cardModel, summaryChips };

const safeStorage = (win) => {
  try {
    return win.localStorage;
  } catch {
    return undefined; // blocked storage: the page works for the session, with no saved progress
  }
};

/** The list: a heading and the groups with their exercises, each with a one-line goal and its summary chips. */
export function listModel({ progress, i18n }) {
  const t = i18n.t;
  return {
    heading: t("common.practice"),
    groups: GROUPS.map((id) => ({
      id,
      title: t(`practice.group.${id}`),
      hint: t(`practice.groupHint.${id}`),
      items: exercisesIn(id).map((e) => ({ id: e.id, href: `#/practice/${e.id}`, title: t(`ex.${e.id}.title`), goal: t(`ex.${e.id}.goal`), chips: summaryChips(summaryOf(progress, e.id), t) })),
    })),
  };
}

// "Reset progress" asks once, inline ("Reset all practice progress? Yes No"), and never opens a dialog.
function resetRow({ confirming, t, onAsk, onYes, onNo }) {
  const button = (action, label, handler) => {
    const b = el("button", { type: "button", class: "btn", "data-action": action }, label);
    b.addEventListener("click", handler);
    return b;
  };
  if (!confirming) return el("div", { class: "practice-reset" }, button("RESET", t("common.resetProgress"), onAsk));
  return el("div", { class: "practice-reset", role: "group", "aria-label": t("practice.reset.ask") }, el("span", {}, t("practice.reset.ask")), button("RESET_YES", t("practice.reset.yes"), onYes), button("RESET_NO", t("practice.reset.no"), onNo));
}

function listScreen(model, reset, today) {
  return el(
    "section",
    { class: "practice" },
    el("h2", {}, model.heading),
    today,
    model.groups.map((g) =>
      el(
        "section",
        { class: "practice-group", "data-group": g.id },
        el("h3", {}, g.title),
        el("p", { class: "meta" }, g.hint),
        el(
          "ul",
          { class: "cards practice-cards" },
          g.items.map((item) =>
            el(
              "li",
              { class: "card practice-item", "data-exercise": item.id },
              el("h4", { class: "practice-item-title" }, el("a", { href: item.href }, item.title)),
              el("p", { class: "meta" }, item.goal),
              item.chips.length > 0 ? el("p", { class: "chips" }, item.chips.map((c) => el("span", { class: "chip" }, c))) : null,
            ),
          ),
        ),
      ),
    ),
    reset,
  );
}

function cardScreen(model, { back }) {
  return el(
    "section",
    { class: "practice practice-page", "data-exercise": model.id },
    el("div", { class: "practice-top" }, el("a", { class: "button button-secondary", href: "#/practice" }, back), el("h2", { class: "practice-title" }, model.title)),
    docArticle(model),
  );
}

/**
 * practiceView({ i18n, win, storage }) returns a router view (route, root) => { dispose() }. `route.songId` is the
 * exercise id of "#/practice/<id>" (null for the list). An id the catalog does not have shows "Exercise not found"
 * and a link back to the list. A run exercise opens its page (choices, keys to press, feedback), an ear drill its own
 * (play, answer, count) and the routine its four blocks in order. The exercise page repaints itself when the language changes, so this view
 * leaves it alone (a redraw would lose the step, key and tempo).
 */
export function practiceView({ i18n, win = window, storage = safeStorage(win), makeEngine, today = () => localIsoDate() } = {}) {
  const t = i18n.t;
  return (route, root) => {
    let disposed = false;
    let page = null;
    let confirming = false;
    let todayCard = null;
    const exercise = route.songId ? exerciseById(route.songId) : null;

    function render() {
      if (route.songId && !exercise) {
        root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, t("practice.notFound")), el("a", { class: "button", href: "#/practice" }, t("practice.back"))));
      } else if (exercise?.kind === "run" || exercise?.kind === "ear" || exercise?.kind === "routine") {
        const make = { run: createExercisePage, ear: createEarPage, routine: createRoutinePage }[exercise.kind];
        page = make({ i18n, win, storage, exercise, makeEngine });
        if (page) root.replaceChildren(page.element);
        else root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, t("practice.notFound")), el("a", { class: "button", href: "#/practice" }, t("practice.back"))));
      } else if (exercise) {
        root.replaceChildren(cardScreen(cardModel({ exercise, i18n }), { back: t("practice.back") }));
      } else {
        const reset = resetRow({
          confirming,
          t,
          onAsk: () => {
            confirming = true;
            render();
          },
          onYes: () => {
            clearPracticeProgress(storage);
            confirming = false;
            render();
          },
          onNo: () => {
            confirming = false;
            render();
          },
        });
        const progress = readPracticeProgress(storage);
        // One Today card for the life of the list: it is redrawn with the progress, and it follows the language itself.
        todayCard ??= createTodayCard({ i18n });
        todayCard.set({ progress, today: today() });
        root.replaceChildren(listScreen(listModel({ progress, i18n }), reset, todayCard.element));
      }
    }

    render();
    const off = i18n.onChange(() => {
      if (!disposed && !page) render();
    });
    return {
      dispose() {
        disposed = true;
        off();
        page?.dispose();
        page = null;
        todayCard?.dispose();
        todayCard = null;
      },
    };
  };
}
