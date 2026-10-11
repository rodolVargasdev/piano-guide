// Hash router. `parseHash` is pure (testable under node); `createRouter` is the DOM dispatcher.
//
// Routes: "#/" is the catalog; "#/song/<id>?level=<id>&names=solfege|letters&view=both|scene|score"
// is the player; "#/learn/<id>?level=<id>" is Learn mode; "#/practice" and "#/practice/<id>" are the
// practice exercises (their view arrives later: until then the router sends them to "unknown").
// Anything else is "unknown".

import { el } from "./dom.js";

const NAMES = ["solfege", "letters"];
const VIEWS = ["both", "scene", "score"];
const SONG_ID = /^[a-z0-9-]+$/;

/** True when a string is a well-formed song id (the id is matched against the index afterwards). */
export function isSongId(id) {
  return typeof id === "string" && SONG_ID.test(id);
}

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Parses a location hash into { route, songId, level, names, view }.
 * route is "catalog", "song", "learn", "practice" or "unknown". songId is the raw decoded text: it is NOT
 * trusted here and must only be rendered through textContent. names and view fall back to
 * their defaults on any other value; level is null unless it is a well-formed id.
 */
export function parseHash(hash) {
  const text = typeof hash === "string" ? hash.replace(/^#/, "") : "";
  const [path, query = ""] = text.split("?", 2);
  const parts = path.split("/").filter((p, i) => !(p === "" && i === 0));
  const base = { songId: null, level: null, names: "solfege", view: "both" };
  if (text !== "" && !text.startsWith("/")) return { route: "unknown", ...base };

  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) return { route: "catalog", ...base };
  if (parts[0] === "song" && parts.length === 2 && parts[1] !== "") {
    const params = new URLSearchParams(query);
    const level = params.get("level");
    const names = params.get("names");
    const view = params.get("view");
    return {
      route: "song",
      songId: decode(parts[1]),
      level: level !== null && SONG_ID.test(level) ? level : null,
      names: NAMES.includes(names) ? names : base.names,
      view: VIEWS.includes(view) ? view : base.view,
    };
  }
  if (parts[0] === "learn" && parts.length === 2 && parts[1] !== "") {
    const level = new URLSearchParams(query).get("level");
    return { route: "learn", ...base, songId: decode(parts[1]), level: level !== null && SONG_ID.test(level) ? level : null };
  }
  if (parts[0] === "practice" && parts.length <= 2) {
    return { route: "practice", ...base, songId: parts[1] ? decode(parts[1]) : null };
  }
  return { route: "unknown", ...base };
}

/** A "not found" screen with a link back to the catalog. `text` is shown via textContent only. */
export function notFoundView(message) {
  return (route, mount) => {
    mount.replaceChildren(
      el("section", { class: "panel", role: "alert" }, el("h2", {}, message), el("a", { class: "button", href: "#/" }, "Back to the catalog")),
    );
    return { dispose() {} };
  };
}

// What a lazy view shows while its module loads and when it cannot be loaded.
function showLazyState(root, kind) {
  if (kind === "loading") root.replaceChildren(el("p", { class: "meta", role: "status" }, "Loading"));
  else root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, "This page could not be loaded"), el("a", { class: "button", href: "#/" }, "Back to the catalog")));
}

/**
 * lazyView(load) wraps a view whose module is fetched on first use, so the catalog route does not
 * download the player, the audio engine, the score and the scene. `load()` resolves to the view
 * function ((route, mount) => { dispose() }). A dispose before the module arrives mounts nothing;
 * a failed load shows a message instead of a blank page. `show(root, "loading" | "failed")` is injectable.
 */
export function lazyView(load, { show = showLazyState } = {}) {
  return (route, root) => {
    let inner = null;
    let disposed = false;
    show(root, "loading");
    load().then(
      (make) => {
        if (!disposed) inner = make(route, root);
      },
      () => {
        if (!disposed) show(root, "failed");
      },
    );
    return {
      dispose() {
        disposed = true;
        inner?.dispose();
        inner = null;
      },
    };
  };
}

/**
 * createRouter({ mount, views, store, win }) returns { start, stop }.
 * views: { catalog, song, unknown }, each (route, mount) => { dispose() }.
 * On EVERY hash change (the back button included) the previous view's dispose() runs first.
 */
export function createRouter({ mount, views, store, win = window }) {
  let current = null;

  function dispatch() {
    if (current) {
      current.dispose();
      current = null;
    }
    mount.replaceChildren();
    const route = parseHash(win.location.hash);
    const view = views[route.route] ?? views.unknown;
    current = view(route, mount) ?? { dispose() {} };
    if (store) store.set("route", route);
  }

  return {
    start() {
      win.addEventListener("hashchange", dispatch);
      dispatch();
    },
    stop() {
      win.removeEventListener("hashchange", dispatch);
      if (current) current.dispose();
      current = null;
    },
  };
}
