// Page credits: the license credit the piano samples require (CC BY 3.0 asks for the author, the license and
// whether the files were changed). One footer for every page, in the learner's language, with a link to the
// license file that sits beside the samples.

import { el } from "./dom.js";

export const LICENSE_HREF = "./assets/audio/piano/LICENSE.txt";

/** createCredits({ i18n }) returns { element, dispose() }. */
export function createCredits({ i18n }) {
  const text = el("span", { class: "credits-text" });
  const link = el("a", { class: "credits-link", href: LICENSE_HREF, target: "_blank", rel: "noopener" });
  const element = el("footer", { class: "credits" }, text, " ", link);

  function sync() {
    text.textContent = i18n.t("credits.piano");
    link.textContent = i18n.t("credits.license");
  }
  sync();
  const off = i18n.onChange(sync);

  return {
    element,
    dispose() {
      off();
      element.remove();
    },
  };
}
