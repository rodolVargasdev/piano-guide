// Language selector: two buttons, "English" and "Español", the current one pressed. Choosing one
// calls i18n.setLang, which saves it and notifies every view, so the page switches at once and
// keeps its place. Option names are the languages' own names and never translated.

import { el } from "./dom.js";

const LANGS = ["en", "es"];

/** createLanguageSelect({ i18n }) returns { element, dispose() }. */
export function createLanguageSelect({ i18n }) {
  const group = el("div", { class: "language-select", role: "group", "aria-label": i18n.t("common.language") });
  const buttons = LANGS.map((lang) => {
    const button = el("button", { type: "button", class: "btn lang-btn", lang, "aria-pressed": "false" }, i18n.t(`lang.${lang}`));
    button.addEventListener("click", () => i18n.setLang(lang));
    return button;
  });
  group.append(...buttons);

  function sync() {
    group.setAttribute("aria-label", i18n.t("common.language"));
    buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(LANGS[i] === i18n.lang())));
  }
  sync();
  const off = i18n.onChange(sync);

  return {
    element: group,
    dispose() {
      off();
      group.remove();
    },
  };
}
