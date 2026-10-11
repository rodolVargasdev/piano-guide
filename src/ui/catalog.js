// Catalog: loads songs/index.json, validates it and every indexed song, and renders cards.
// `loadCatalog` has no DOM access and takes an injectable fetcher, so it runs under node --test.

import { validateIndex, validateSong } from "../core/schema.js";
import { el } from "./dom.js";

const INDEX_URL = "songs/index.json";

async function defaultFetchJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const firstReason = (errors) => `${errors[0].path || "file"}: ${errors[0].message}`;
const allReasons = (errors) => errors.map((e) => `${e.path || "file"}: ${e.message}`).join("\n");

/**
 * Resolves to { error, entries }.
 * - error: null, or { reason } when the index cannot be loaded or is invalid (never throws).
 * - entries: [{ entry, status: "ok" | "unavailable", song?, reason?, reasons? }], in index order.
 * Every indexed file is fetched and validated in parallel; a broken one only marks its own entry.
 */
export async function loadCatalog(fetchJson = defaultFetchJson) {
  let index;
  try {
    index = await fetchJson(INDEX_URL);
  } catch (e) {
    return { error: { reason: String(e?.message ?? e) }, entries: [] };
  }
  const checked = validateIndex(index);
  if (!checked.ok) return { error: { reason: firstReason(checked.errors) }, entries: [] };

  const entries = await Promise.all(
    index.songs.map(async (entry) => {
      try {
        const song = await fetchJson(`songs/${entry.file}`);
        const result = validateSong(song);
        if (!result.ok) return { entry, status: "unavailable", reason: firstReason(result.errors), reasons: allReasons(result.errors) };
        if (song.id !== entry.id) {
          const reason = `id: song file says "${song.id}" but the index says "${entry.id}"`;
          return { entry, status: "unavailable", reason, reasons: reason };
        }
        return { entry, status: "ok", song };
      } catch (e) {
        const reason = `File could not be loaded (${String(e?.message ?? e)})`;
        return { entry, status: "unavailable", reason, reasons: reason };
      }
    }),
  );
  return { error: null, entries };
}

const keyText = (key) => `${key.tonic} ${key.mode}`;

/**
 * What the hero says, as plain data (so it can be tested without a DOM): a badge counting the
 * songs and levels that are usable, and the song the call to action opens. A catalog whose songs
 * are all unavailable has no call to action.
 */
export function heroModel(entries) {
  const usable = entries.filter((e) => e.status === "ok");
  const levels = new Set(usable.flatMap((e) => e.entry.levels)).size;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return {
    title: "See the piece before you play it",
    lead: "Falling notes on a 3D keyboard, a clean score and slow practice tools.",
    badge: `${plural(usable.length, "song")} | ${plural(levels, "level")}`,
    start: usable[0] ? { id: usable[0].entry.id, title: usable[0].entry.title } : null,
  };
}

// Decorative falling notes over a drawn keyboard, all CSS: no canvas, no three.js on the catalog
// route. Hidden from assistive technology; frozen by the global reduced-motion rule.
const HERO_NOTES = ["n1 hand-r", "n2 hand-l", "n3 hand-r", "n4 hand-l", "n5 hand-r", "n6 hand-l", "n7 hand-r"];

function hero(entries) {
  const m = heroModel(entries);
  return el(
    "section",
    { class: "hero", "aria-label": "Piano Guide" },
    el("p", { class: "hero-badge" }, m.badge),
    el("h2", {}, m.title),
    el("p", { class: "hero-lead" }, m.lead),
    m.start ? el("a", { class: "button", href: `#/song/${m.start.id}` }, `Start with ${m.start.title}`) : null,
    el("div", { class: "hero-stage", "aria-hidden": "true" }, HERO_NOTES.map((c) => el("span", { class: `hero-note ${c}` }))),
    el("div", { class: "hero-keys", "aria-hidden": "true" }),
  );
}

function card({ entry, status, reason, reasons }) {
  const chips = entry.levels.map((l) => el("span", { class: `chip chip-${l}` }, l));
  if (status !== "ok") {
    return el(
      "li",
      { class: "card card-unavailable", title: reasons },
      el("h3", {}, entry.title),
      el("p", { class: "meta" }, entry.composer),
      el("p", {}, el("span", { class: "chip chip-warn" }, "Unavailable"), " ", reason),
    );
  }
  return el(
    "li",
    { class: "card" },
    el("h3", {}, entry.title),
    el("p", { class: "meta" }, entry.composer),
    el("p", { class: "meta" }, `${keyText(entry.key)} | ${entry.defaultBpm} BPM`),
    el("p", { class: "chips" }, chips),
    el("a", { class: "button", href: `#/song/${entry.id}` }, "Open"),
  );
}

/** Renders loaded catalog data into `mount`. Text is inserted with text nodes only. */
export function renderCatalog(mount, { error, entries }) {
  if (error) {
    mount.replaceChildren(
      el("section", { class: "panel", role: "alert" }, el("h2", {}, "Song list could not be loaded"), el("p", { class: "meta" }, error.reason)),
    );
    return;
  }
  if (entries.length === 0) {
    mount.replaceChildren(el("section", { class: "panel" }, el("h2", {}, "No songs yet")));
    return;
  }
  mount.replaceChildren(hero(entries), el("ul", { class: "cards" }, entries.map(card)));
}

/** Router view: shows a loading line, then the catalog. dispose() stops a late response from rendering. */
export function catalogView(route, mount, fetchJson) {
  let disposed = false;
  mount.replaceChildren(el("p", { class: "meta", role: "status" }, "Loading songs"));
  loadCatalog(fetchJson).then((data) => {
    if (!disposed) renderCatalog(mount, data);
  });
  return {
    dispose() {
      disposed = true;
    },
  };
}
