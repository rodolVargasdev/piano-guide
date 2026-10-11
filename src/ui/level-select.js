// Level selection: which level opens, which levels the selector offers, where the musical
// position lands when the level changes, and how the choices live in the hash and in the
// session. The functions are pure (storage is injected) and covered by node tests;
// createLevelSelect at the end only wires buttons to callbacks.

import { el } from "./dom.js";
import { barBeatOf, tickOfBarBeat } from "../core/timing.js";
import { textOf } from "../core/text.js";

const ORDER = ["beginner", "original"];
const prefixKey = "piano-guide:level:";

/** The sessionStorage key that remembers the last level of a song. */
export const levelKey = (songId) => `${prefixKey}${songId}`;

const has = (song, id) => typeof id === "string" && Object.hasOwn(song.levels, id);

/**
 * Level to open: the hash `requested` level when the song has it, else the level remembered for
 * this session, else the song's default. Unknown ids (and inherited names such as "toString")
 * fall through to the next source.
 */
export function resolveLevelId(song, requested, remembered = null) {
  if (has(song, requested)) return requested;
  if (has(song, remembered)) return remembered;
  return song.defaultLevel;
}

/** The levels the selector lists: only those present, beginner first. `single` means a static chip. */
export function levelChoices(song) {
  const ids = Object.keys(song.levels).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  return { ids, single: ids.length === 1 };
}

/**
 * Tick in `to` that has the same bar and beat (and offset inside the beat) as `tick` has in
 * `from`, clamped to [0, to.lengthTicks]. A level switch keeps the musical position this way.
 */
export function mapPosition(tick, from, to) {
  const at = barBeatOf(tick, from.meter, from.pickupTicks, from.tempo.beatUnit);
  const mapped = tickOfBarBeat(at, to.meter, to.pickupTicks, to.tempo.beatUnit);
  return Math.max(0, Math.min(to.lengthTicks, mapped));
}

/**
 * A new hash with `changes` (any of level, names, view) written into the query and every other
 * parameter (such as debug=1) kept. Values are encoded by URLSearchParams.
 */
export function updateHash(hash, changes) {
  const [path, query = ""] = String(hash ?? "").replace(/^#/, "").split("?", 2);
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(changes)) params.set(k, v);
  const text = params.toString();
  return `#${path}${text ? `?${text}` : ""}`;
}

/** Reads the remembered level; any storage failure (blocked, full, private mode) reads as nothing. */
export function readRemembered(storage, songId) {
  try {
    return storage?.getItem(levelKey(songId)) ?? null;
  } catch {
    return null;
  }
}

/** Remembers the level for this session; returns false when storage refuses. */
export function remember(storage, songId, levelId) {
  try {
    storage.setItem(levelKey(songId), levelId);
    return true;
  } catch {
    return false;
  }
}

/** Which controls the selector shows for a level: names only on the labelled notation, Analysis only with entries. */
export function controlsFor(song, levelId) {
  const level = song.levels[levelId] ?? {};
  return { names: level.notation === "labelled", analysis: Array.isArray(level.analysis) && level.analysis.length > 0 };
}

const VIEWS = [
  ["both", "Both", "Keyboard and score"],
  ["scene", "Keyboard", "Keyboard only"],
  ["score", "Score", "Score only"],
];
const NAMES = [
  ["solfege", "Do Re Mi", "Note names in solfege"],
  ["letters", "C D E", "Note names as letters"],
];

/**
 * createLevelSelect({ song, state, onLevel, onNames, onAnalysis, onView, lang }) returns { element, update(patch) }.
 * Level labels and descriptions may be LocalizedText; `lang` ("en" by default) picks the text.
 * state is { levelId, names, view, analysis }. A single-level song shows its level as a static chip;
 * the names toggle appears only on the labelled notation and the Analysis toggle only when the
 * active level has analysis entries. Every control calls its callback and redraws immediately.
 */
export function createLevelSelect({ song, state, onLevel, onNames, onAnalysis, onView, lang = "en" }) {
  const st = { ...state };
  const element = el("div", { class: "level-select" });
  const pick = (label, pressed, title, onClick) => {
    const b = el("button", { type: "button", class: "btn", "aria-pressed": String(pressed), title }, label);
    b.addEventListener("click", onClick);
    return b;
  };
  const group = (name, ...items) => el("div", { class: "seg", role: "group", "aria-label": name }, ...items);

  function render() {
    const { ids, single } = levelChoices(song);
    const controls = controlsFor(song, st.levelId);
    const parts = [
      single
        ? el("span", { class: "chip", title: "The only level of this song" }, textOf(song.levels[ids[0]].label, lang))
        : group("Level", ...ids.map((id) => pick(textOf(song.levels[id].label, lang), id === st.levelId, textOf(song.levels[id].description ?? "", lang), () => change({ levelId: id }, () => onLevel(id))))),
    ];
    if (controls.names) parts.push(group("Note names", ...NAMES.map(([id, text, title]) => pick(text, id === st.names, title, () => change({ names: id }, () => onNames(id))))));
    if (controls.analysis) parts.push(pick("Analysis", st.analysis, "Roman numerals and notes on the harmony", () => {
      const next = !st.analysis;
      change({ analysis: next }, () => onAnalysis(next));
    }));
    parts.push(group("View", ...VIEWS.map(([id, text, title]) => pick(text, id === st.view, title, () => change({ view: id }, () => onView(id))))));
    element.replaceChildren(...parts);
  }
  function change(patch, notify) {
    Object.assign(st, patch);
    notify();
    render();
  }
  render();
  return {
    element,
    update(patch) {
      Object.assign(st, patch);
      render();
    },
  };
}
