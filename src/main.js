// Boot: store and router. The player view arrives in a later PR; until then a known
// song id shows a short notice and an unknown id shows "Song not found".

import { createStore } from "./ui/state.js";
import { createRouter, notFoundView } from "./ui/router.js";
import { catalogView, loadCatalog } from "./ui/catalog.js";
import { el } from "./ui/dom.js";

const mount = document.getElementById("app");
const store = createStore({ route: null });

function songView(route, root) {
  let disposed = false;
  root.replaceChildren(el("p", { class: "meta", role: "status" }, "Loading song"));
  loadCatalog().then(({ entries }) => {
    if (disposed) return;
    const found = entries.find((e) => e.entry.id === route.songId);
    if (!found) return void notFoundView("Song not found")(route, root);
    const title = found.status === "ok" ? "The player is not available yet" : "This song is unavailable";
    root.replaceChildren(
      el("section", { class: "panel" }, el("h2", {}, title), found.reason && el("p", { class: "meta" }, found.reason), el("a", { class: "button", href: "#/" }, "Back to the catalog")),
    );
  });
  return {
    dispose() {
      disposed = true;
    },
  };
}

createRouter({
  mount,
  store,
  views: {
    catalog: (route, root) => catalogView(route, root),
    song: songView,
    unknown: notFoundView("Page not found"),
  },
}).start();
