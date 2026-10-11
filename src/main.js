// Boot: store and router. The song route opens the player view.

import { createStore } from "./ui/state.js";
import { createRouter, notFoundView } from "./ui/router.js";
import { catalogView } from "./ui/catalog.js";
import { playerView } from "./ui/player.js";

const mount = document.getElementById("app");
const store = createStore({ route: null });

createRouter({
  mount,
  store,
  views: {
    catalog: (route, root) => catalogView(route, root),
    song: playerView(),
    unknown: notFoundView("Page not found"),
  },
}).start();
