// Boot: store, translator and router. The song route opens the player view.

import { createStore } from "./ui/state.js";
import { createRouter, notFoundView, lazyView } from "./ui/router.js";
import { catalogView } from "./ui/catalog.js";
import { createI18n } from "./i18n/i18n.js";
import { STRINGS } from "./i18n/strings.js";
import { createLanguageSelect } from "./ui/language-select.js";
import { createCredits } from "./ui/credits.js";
import { el } from "./ui/dom.js";

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
// The header holds the way to Practice exercises and the language selector on every page.
const practiceLink = el("a", { class: "header-link", href: "#/practice" }, i18n.t("common.practice"));
i18n.onChange(() => (practiceLink.textContent = i18n.t("common.practice")));
document.querySelector("header")?.append(practiceLink, createLanguageSelect({ i18n }).element);

// The sample license credit is on every page, below the content.
mount.after(createCredits({ i18n }).element);

createRouter({
  mount,
  store,
  views: {
    catalog: (route, root) => catalogView(route, root, { i18n }),
    // The player pulls in the audio engine, the score and the scene: fetched when a song opens, not for the catalog.
    song: lazyView(() => import("./ui/player.js").then((m) => m.playerView({ i18n }))),
    // Learn pulls in the keyboard, the inputs and the audio engine: fetched when a lesson opens.
    learn: lazyView(() => import("./ui/learn-view.js").then((m) => m.learnView({ i18n }))),
    // Practice exercises: the list and the cards; the page for a run pulls in the keyboard and the audio engine later.
    practice: lazyView(() => import("./ui/practice-view.js").then((m) => m.practiceView({ i18n }))),
    unknown: notFoundView("Page not found"),
  },
}).start();
