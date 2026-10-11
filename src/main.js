// Boot: store and router. The song route opens the player view.

import { createStore } from "./ui/state.js";
import { createRouter, notFoundView, lazyView } from "./ui/router.js";
import { catalogView } from "./ui/catalog.js";

const mount = document.getElementById("app");
const store = createStore({ route: null });

createRouter({
  mount,
  store,
  views: {
    catalog: (route, root) => catalogView(route, root),
    // The player pulls in the audio engine, the score and the scene: fetched when a song opens, not for the catalog.
    song: lazyView(() => import("./ui/player.js").then((m) => m.playerView())),
    unknown: notFoundView("Page not found"),
  },
}).start();
