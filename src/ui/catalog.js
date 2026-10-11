// Catalog: loads songs/index.json (and, when present, songs-private/index.json), validates both and every
// indexed song, and renders cards. `loadCatalog` has no DOM access and takes injectable fetchers, so it runs
// under node --test. A private library is a runtime option: absent means no private songs and no message.

import { validateIndex, validateSong, visibilityMismatch } from "../core/schema.js";
import { resolveLevel } from "../core/timeline.js";
import { visibilityOf } from "../core/visibility.js";
import { createI18n } from "../i18n/i18n.js";
import { STRINGS } from "../i18n/strings.js";
import { el } from "./dom.js";

const INDEX_URL = "songs/index.json";
const PRIVATE_DIR = "songs-private";

async function defaultFetchJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Three-state fetch for the optional private library. Resolves to { status: "absent" } for a network
 * failure, a non-2xx answer or a content type that is not JSON (GitHub Pages answers an HTML 404 page, some
 * servers answer HTML with 200); { status: "invalid", reason } for a JSON-typed body that does not parse;
 * { status: "ok", json } otherwise. `fetchFn` is injectable. Never throws.
 */
export async function fetchJsonOrAbsent(url, fetchFn = (u, o) => fetch(u, o)) {
  let res;
  try {
    res = await fetchFn(url, { cache: "no-cache" });
  } catch {
    return { status: "absent" };
  }
  if (!res?.ok || !/json/i.test(res.headers?.get?.("content-type") ?? "")) return { status: "absent" };
  try {
    return { status: "ok", json: await res.json() };
  } catch {
    return { status: "invalid", reason: "not valid JSON" };
  }
}

const firstReason = (errors) => `${errors[0].path || "file"}: ${errors[0].message}`;
const allReasons = (errors) => errors.map((e) => `${e.path || "file"}: ${e.message}`).join("\n");
const unavailable = (entry, reason, reasons = reason, reasonKey = undefined) => ({ entry, status: "unavailable", reason, reasons, ...(reasonKey ? { reasonKey } : {}) });

// Validates one fetched song file against its index entry. `kind` is "public" or "private".
function checkSong(entry, song, kind) {
  const result = validateSong(song);
  if (!result.ok) return unavailable(entry, firstReason(result.errors), allReasons(result.errors));
  if (song.id !== entry.id) return unavailable(entry, `id: song file says "${song.id}" but the index says "${entry.id}"`);
  const mismatch = visibilityMismatch(entry, song);
  if (mismatch) return unavailable(entry, mismatch, mismatch, "catalog.visibilityMismatch");
  if (kind === "private" && visibilityOf(song) !== "private") return unavailable(entry, "the file is not marked private", undefined, "catalog.notPrivate");
  if (kind === "public" && visibilityOf(song) === "private") return unavailable(entry, "a public library file is marked private", undefined, "catalog.publicIsPrivate");
  return { entry, status: "ok", song };
}

async function loadEntry(entry, url, fetchOne, kind) {
  try {
    return { ...checkSong(entry, await fetchOne(url), kind), ...(kind === "private" ? { private: true } : {}) };
  } catch (e) {
    return { ...unavailable(entry, `File could not be loaded (${String(e?.message ?? e)})`), ...(kind === "private" ? { private: true } : {}) };
  }
}

/**
 * Resolves to { error, entries, privateNotice? }.
 * - error: null, or { reason } when the public index cannot be loaded or is invalid (never throws).
 * - entries: [{ entry, status: "ok" | "unavailable", song?, reason?, reasons?, reasonKey?, private? }]: the
 *   public entries in index order, then the private ones. A broken file only marks its own entry.
 * - privateNotice: true only when a private index exists but cannot be read (one notice, nothing else).
 * An id shared with a public song, an index and a file that disagree on visibility, and a private entry
 * whose file is not marked private all make the entry unavailable. Absent private index: no message.
 * `fetchPrivate(url)` is the three-state fetcher (see fetchJsonOrAbsent); it defaults to that one for the
 * real page and to "absent" when only `fetchJson` is injected (no private lookup unless a test asks for it).
 */
export async function loadCatalog(fetchJson = defaultFetchJson, { fetchPrivate = fetchJson === defaultFetchJson ? fetchJsonOrAbsent : async () => ({ status: "absent" }) } = {}) {
  let index;
  try {
    index = await fetchJson(INDEX_URL);
  } catch (e) {
    return { error: { reason: String(e?.message ?? e) }, entries: [] };
  }
  const checked = validateIndex(index);
  if (!checked.ok) return { error: { reason: firstReason(checked.errors) }, entries: [] };

  const publicIds = new Set(index.songs.map((e) => e.id));
  const [publicEntries, priv] = await Promise.all([
    Promise.all(index.songs.map((entry) => loadEntry(entry, `songs/${entry.file}`, fetchJson, "public"))),
    loadPrivate(fetchPrivate, publicIds),
  ]);
  return { error: null, entries: [...publicEntries, ...priv.entries], ...(priv.notice ? { privateNotice: true } : {}) };
}

async function loadPrivate(fetchPrivate, publicIds) {
  const res = await fetchPrivate(`${PRIVATE_DIR}/index.json`);
  if (res.status === "absent") return { entries: [] };
  if (res.status !== "ok" || !validateIndex(res.json).ok) return { entries: [], notice: true };
  const fetchOne = async (url) => {
    const r = await fetchPrivate(url);
    if (r.status !== "ok") throw new Error(r.status === "absent" ? "not found" : r.reason);
    return r.json;
  };
  const entries = await Promise.all(
    res.json.songs.map((entry) =>
      publicIds.has(entry.id)
        ? Promise.resolve({ ...unavailable(entry, "id already used by a public song", undefined, "catalog.idUsed"), private: true })
        : loadEntry(entry, `${PRIVATE_DIR}/${entry.file}`, fetchOne, "private"),
    ),
  );
  return { entries };
}

const isPlayable = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;

/** True when some level of the song has at least one pitched note: only then does a card offer "Learn". */
export function canLearn(song) {
  try {
    return Object.keys(song?.levels ?? {}).some((id) => resolveLevel(song, id).notes.some(isPlayable));
  } catch {
    return false;
  }
}

const english = () => createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => {} });

/**
 * What the hero says, as plain data (so it can be tested without a DOM): a badge counting the
 * songs and levels that are usable, and the song the call to action opens. A catalog whose songs
 * are all unavailable has no call to action. `i18n` defaults to an English translator.
 */
export function heroModel(entries, i18n = english()) {
  const usable = entries.filter((e) => e.status === "ok");
  const levels = new Set(usable.flatMap((e) => e.entry.levels)).size;
  return {
    title: i18n.t("catalog.hero.title"),
    lead: i18n.t("catalog.hero.lead"),
    badge: i18n.t("catalog.badge", { songs: i18n.t("catalog.songs", { count: usable.length }), levels: i18n.t("catalog.levels", { count: levels }) }),
    start: usable[0] ? { id: usable[0].entry.id, title: usable[0].entry.title } : null,
  };
}

// Decorative falling notes over a drawn keyboard, all CSS: no canvas, no three.js on the catalog
// route. Hidden from assistive technology; frozen by the global reduced-motion rule.
const HERO_NOTES = ["n1 hand-r", "n2 hand-l", "n3 hand-r", "n4 hand-l", "n5 hand-r", "n6 hand-l", "n7 hand-r"];

function hero(entries, i18n) {
  const m = heroModel(entries, i18n);
  const learn = m.start ? canLearn(entries.find((e) => e.entry.id === m.start.id)?.song) : false;
  return el(
    "section",
    { class: "hero", "aria-label": "Piano Guide" },
    el("p", { class: "hero-badge" }, m.badge),
    el("h2", {}, m.title),
    el("p", { class: "hero-lead" }, m.lead),
    el(
      "div",
      { class: "hero-actions" },
      m.start ? el("a", { class: "button", href: `#/${learn ? "learn" : "song"}/${m.start.id}` }, i18n.t("catalog.hero.start", { title: m.start.title })) : null,
      el("a", { class: "button button-secondary", href: "#/practice" }, i18n.t("common.practice")),
    ),
    el("div", { class: "hero-stage", "aria-hidden": "true" }, HERO_NOTES.map((c) => el("span", { class: `hero-note ${c}` }))),
    el("div", { class: "hero-keys", "aria-hidden": "true" }),
  );
}

const KEY_NAMES = { major: "key.major", minor: "key.minor" };
const levelText = (i18n, id) => (id === "beginner" || id === "original" ? i18n.t(`level.${id}`) : id);

function card({ entry, status, reason, reasons, reasonKey, private: isPrivate, song }, i18n) {
  const chips = [isPrivate ? el("span", { class: "chip chip-private" }, i18n.t("common.private")) : null, ...entry.levels.map((l) => el("span", { class: `chip chip-${l}` }, levelText(i18n, l)))];
  if (status !== "ok") {
    return el(
      "li",
      { class: "card card-unavailable", title: reasons },
      el("h3", {}, entry.title),
      el("p", { class: "meta" }, entry.composer),
      el("p", { class: "chips" }, chips),
      el("p", {}, el("span", { class: "chip chip-warn" }, i18n.t("catalog.unavailable")), " ", reasonKey ? i18n.t(reasonKey) : reason),
    );
  }
  const keyText = KEY_NAMES[entry.key.mode] ? i18n.t(KEY_NAMES[entry.key.mode], { tonic: entry.key.tonic }) : `${entry.key.tonic} ${entry.key.mode}`;
  return el(
    "li",
    { class: `card${isPrivate ? " card-private" : ""}` },
    el("h3", {}, entry.title),
    el("p", { class: "meta" }, entry.composer),
    el("p", { class: "meta" }, `${keyText} | ${entry.defaultBpm} BPM`),
    el("p", { class: "chips" }, chips),
    isPrivate ? el("p", { class: "meta card-note" }, i18n.t("learn.silent")) : null,
    el(
      "div",
      { class: "card-actions" },
      canLearn(song) ? el("a", { class: "button", href: `#/learn/${entry.id}` }, i18n.t("common.learn")) : null,
      el("a", { class: "button button-secondary", href: `#/song/${entry.id}` }, i18n.t(isPrivate ? "common.playAlongNoSound" : "common.playAlong")),
    ),
  );
}

/** Renders loaded catalog data into `mount`. Text is inserted with text nodes only. */
export function renderCatalog(mount, { error, entries, privateNotice }, i18n = english()) {
  if (error) {
    mount.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, i18n.t("catalog.loadError")), el("p", { class: "meta" }, error.reason)));
    return;
  }
  if (entries.length === 0) {
    mount.replaceChildren(el("section", { class: "panel" }, el("h2", {}, i18n.t("catalog.empty"))));
    return;
  }
  const notice = privateNotice ? [el("p", { class: "meta", role: "status" }, i18n.t("catalog.privateNotice"))] : [];
  mount.replaceChildren(hero(entries, i18n), ...notice, el("ul", { class: "cards" }, entries.map((e) => card(e, i18n))));
}

/**
 * Router view: shows a loading line, then the catalog, and draws it again when the language changes.
 * `deps` is { fetchJson, fetchPrivate, i18n }. dispose() stops a late response from rendering.
 */
export function catalogView(route, mount, deps = {}) {
  const i18n = deps.i18n ?? english();
  let disposed = false;
  let data = null;
  mount.replaceChildren(el("p", { class: "meta", role: "status" }, i18n.t("catalog.loading")));
  loadCatalog(deps.fetchJson, deps.fetchPrivate ? { fetchPrivate: deps.fetchPrivate } : undefined).then((loaded) => {
    if (disposed) return;
    data = loaded;
    renderCatalog(mount, data, i18n);
  });
  const off = i18n.onChange(() => {
    if (!disposed && data) renderCatalog(mount, data, i18n);
  });
  return {
    dispose() {
      disposed = true;
      off();
    },
  };
}
