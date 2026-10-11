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

function card({ entry, status, reason, reasons }) {
  const chips = entry.levels.map((l) => el("span", { class: "chip" }, l));
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
  mount.replaceChildren(el("ul", { class: "cards" }, entries.map(card)));
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
