// Boot: store, translator and router. The song route opens the player view.

import { createStore } from "./ui/state.js";
import { createRouter, notFoundView, lazyView } from "./ui/router.js";
import { catalogView } from "./ui/catalog.js";
import { createI18n } from "./i18n/i18n.js";
import { STRINGS } from "./i18n/strings.js";
import { createLanguageSelect } from "./ui/language-select.js";

const mount = document.getElementById("app");
const store = createStore({ route: null });

// One translator for the whole page. Reading localStorage can throw when storage is blocked: no storage then.
const storage = (() => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
})();
const i18n = createI18n({ storage, navigatorLanguage: globalThis.navigator?.language, documentElement: document.documentElement, table: STRINGS });
document.querySelector("header")?.append(createLanguageSelect({ i18n }).element);

createRouter({
  mount,
  store,
  views: {
    catalog: (route, root) => catalogView(route, root, { i18n }),
    // The player pulls in the audio engine, the score and the scene: fetched when a song opens, not for the catalog.
    song: lazyView(() => import("./ui/player.js").then((m) => m.playerView({ i18n }))),
    unknown: notFoundView("Page not found"),
  },
}).start();
