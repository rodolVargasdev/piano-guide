// The page of the 10-minute routine: today's four things in order (a warm-up, a scale, chords, an ear drill), each one
// run with the same page as its own exercise, a "Skip block" at any moment, and at the end a summary of what was done
// and how many days in a row. It owns no rule: `routine.js` builds the day and tracks the blocks, the exercise pages
// decide what every press means; this file hosts them one at a time and records the day when the routine ends.
import { buildRoutine, routineReducer, startRoutine, summaryOfRoutine } from "../practice/routine.js";
import { exerciseById } from "../practice/catalog.js";
import { localIsoDate, readPracticeProgress, recordRoutine, writePracticeProgress } from "../practice/progress.js";
import { el } from "./dom.js";
import { createLanguageSelect } from "./language-select.js";
import { createEarPage } from "./practice-ear.js";
import { createExercisePage } from "./practice-run.js";

/** "Scale: Major scales in G major, 3 minutes" as plain text for a block. */
export function blockLine(block, t) {
  const title = t(`ex.${block.exercise}.title`);
  const what = block.key === null ? title : t("routine.item", { exercise: title, key: t("key.major", { tonic: block.key }) });
  return `${t(`routine.block.${block.id}`)}: ${what}, ${t("routine.minutes", { count: block.minutes })}`;
}

/** The intro of today: the four things with their minutes, the total, and the days in a row when there are some. */
export function introModel({ routine, progress, today, i18n }) {
  const t = i18n.t;
  const days = progress.routine.dayStreak;
  return {
    heading: t("ex.routine.title"),
    lines: routine.blocks.map((b) => blockLine(b, t)),
    total: t("routine.total", { minutes: t("routine.minutes", { count: routine.minutes }) }),
    streak: days > 0 && progress.routine.lastDate !== null ? t("routine.daysInRow", { count: days }) : "",
    doneToday: progress.routine.lastDate === today ? t("routine.doneToday") : "",
  };
}

/** The end: every block as done or skipped, and whether and how the day counts. */
export function summaryModel({ summary, progress, i18n }) {
  const t = i18n.t;
  return {
    heading: t("routine.summary.title"),
    lines: summary.blocks.map((b) => ({ text: blockLine(b, t), status: b.status, statusText: t(`routine.status.${b.status}`) })),
    counts: summary.counts ? t("routine.summary.counts", { days: t("routine.daysInRow", { count: progress.routine.dayStreak }) }) : t("routine.summary.none"),
  };
}

/**
 * createRoutinePage({ i18n, win, storage, makeEngine, today, seed }) -> { element, dispose() }, or null for a date that
 * is not a day. `today()` gives the date of the routine (YYYY-MM-DD; injectable for tests and for the next-day check).
 */
export function createRoutinePage({ i18n, win, storage, makeEngine, today = () => localIsoDate(), seed = (Date.now() & 0xffff) + 1 }) {
  const t = i18n.t;
  let progress = readPracticeProgress(storage);
  const date = today();
  const routine = buildRoutine(progress, date);
  if (!routine) return null;
  let session = startRoutine(routine);
  let phase = "intro"; // "intro" | "block" | "summary"
  let blockReady = false;
  let page = null;
  let disposed = false;

  const top = el("div", { class: "learn-top practice-top" });
  const introBox = el("div", { class: "routine-intro-box" });
  const header = el("div", { class: "routine-header" });
  const host = el("div", { class: "routine-host" });
  const controls = el("div", { class: "learn-actions routine-controls" });
  // The controls sit above the block page, so Skip and Next block never need a scroll past the keyboard.
  const blockBox = el("div", { class: "routine-block" }, header, controls, host);
  const summaryBox = el("div", { class: "routine-summary-box" });
  const langSelect = createLanguageSelect({ i18n });
  const view = el("section", { class: "practice routine", "data-phase": "intro" }, top, introBox, blockBox, summaryBox);

  const button = (action, label, handler, primary = false) => {
    const b = el("button", { type: "button", class: `btn learn-action${primary ? " learn-primary" : ""}`, "data-action": action }, label);
    b.addEventListener("click", handler);
    return b;
  };
  function show(next) {
    phase = next;
    view.setAttribute("data-phase", next);
    introBox.hidden = next !== "intro";
    blockBox.hidden = next !== "block";
    summaryBox.hidden = next !== "summary";
  }
  const statusOf = (b, i) => (b.status === "pending" && i === session.current ? "current" : b.status);

  // ---- painting (all of it can be redone when the language changes) ------------------------------------
  function paintTop() {
    top.replaceChildren(el("a", { class: "button button-secondary learn-back", href: "#/practice" }, t("practice.back")), el("h2", { class: "learn-title practice-title" }, t("ex.routine.title")), langSelect.element);
  }
  function paintIntro() {
    const m = introModel({ routine, progress, today: date, i18n });
    introBox.replaceChildren(
      el("section", { class: "learn-card routine-intro" }, el("h3", { class: "learn-instruction" }, m.heading), el("ol", { class: "routine-list" }, m.lines.map((l) => el("li", {}, l))), el("p", { class: "meta" }, [m.total, m.streak, m.doneToday].filter(Boolean).join(" | ")), el("div", { class: "learn-actions" }, button("START_ROUTINE", t("routine.start"), startBlock, true))),
    );
  }
  function paintBlock() {
    const steps = el("ol", { class: "routine-steps" }, session.blocks.map((b, i) => el("li", { class: "routine-step", "data-status": statusOf(b, i), ...(i === session.current ? { "aria-current": "step" } : {}) }, el("span", { class: "routine-step-name" }, t(`routine.block.${b.id}`)), el("span", { class: "routine-step-status" }, t(`routine.status.${statusOf(b, i)}`)))));
    header.replaceChildren(el("p", { class: "learn-progress meta" }, t("routine.step", { n: session.current + 1, total: session.blocks.length })), el("p", { class: "routine-now" }, blockLine(session.blocks[session.current], t)), steps);
    const last = session.blocks.filter((b) => b.status === "pending").length === 1;
    const next = button("NEXT_BLOCK", t(last ? "routine.finish" : "routine.nextBlock"), () => settle("DONE_BLOCK"), true);
    next.hidden = !blockReady;
    controls.replaceChildren(next, button("SKIP_BLOCK", t("routine.skip"), () => settle("SKIP_BLOCK")));
  }
  function paintSummary() {
    const m = summaryModel({ summary: summaryOfRoutine(session), progress, i18n });
    summaryBox.replaceChildren(
      el("section", { class: "learn-card routine-summary" }, el("h3", { class: "learn-instruction" }, m.heading), el("ul", { class: "routine-list" }, m.lines.map((l) => el("li", { "data-status": l.status }, `${l.text}: `, el("strong", {}, l.statusText)))), el("p", { class: "routine-counts" }, m.counts), el("div", { class: "learn-actions" }, el("a", { class: "button", href: "#/practice" }, t("practice.back")))),
    );
  }

  // ---- the flow ------------------------------------------------------------------------------------
  function disposePage() {
    page?.dispose();
    page = null;
    host.replaceChildren();
  }
  function startBlock() {
    disposePage();
    blockReady = false;
    show("block");
    const block = session.blocks[session.current];
    const exercise = exerciseById(block.exercise);
    // A run block is done when the run ends; the ear block when at least one question has been answered.
    const embedded = {
      options: block.options,
      onState: (s) => {
        const ready = exercise.kind === "ear" ? s.round.answered >= 1 : s.phase === "done";
        if (ready !== blockReady) {
          blockReady = ready;
          paintBlock();
        }
      },
    };
    page = (exercise.kind === "ear" ? createEarPage : createExercisePage)({ i18n, win, storage, exercise, makeEngine, seed: seed + session.current, embedded });
    if (page) host.append(page.element);
    paintBlock();
  }
  function settle(type) {
    session = routineReducer(session, { type });
    if (!session.ended) return startBlock();
    disposePage();
    // The day counts when at least one block was done; a routine with everything skipped records nothing.
    progress = recordRoutine(progress, { date, blocks: summaryOfRoutine(session).blocks });
    writePracticeProgress(storage, progress);
    show("summary");
    paintSummary();
  }

  // The block page repaints itself when the language changes, so only the shell around it is redrawn here.
  const offLang = i18n.onChange(() => {
    if (disposed) return;
    paintTop();
    if (phase === "intro") paintIntro();
    else if (phase === "block") paintBlock();
    else paintSummary();
  });
  // The page has its own language selector, like every practice page: the header's one is hidden (and in landscape the header too).
  win.document?.body?.setAttribute("data-route", "practice-run");
  paintTop();
  paintIntro();
  show("intro");

  return {
    element: view,
    dispose() {
      disposed = true;
      offLang();
      disposePage();
      langSelect.dispose();
      win.document?.body?.removeAttribute("data-route");
    },
  };
}
