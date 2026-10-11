// Practice panel: loop A-B, loop by section, tempo ramp with Hold, hands and range. It only draws
// the state of the practice controller and forwards clicks to it; the rules live in
// practice-controller.js and core/practice.js.

import { el } from "./dom.js";
import { formatLoop, QUALITY_CHOICES } from "./practice-controller.js";

const QUALITY_LABELS = { auto: "Auto", high: "High", medium: "Medium", low: "Low", minimum: "Minimum" };

/**
 * createPracticePanel({ practice, timeline }) returns { element, setTimeline(tl) }.
 * The panel redraws on every controller change, so it never holds a state of its own.
 */
export function createPracticePanel({ practice, timeline }) {
  let tl = timeline;
  const button = (label, title, onClick, cls = "btn") => {
    const b = el("button", { type: "button", class: cls, title }, label);
    b.addEventListener("click", onClick);
    return b;
  };
  const toggle = (label, title, onClick) => {
    const b = button(label, title, onClick, "btn toggle");
    b.setAttribute("aria-pressed", "false");
    return b;
  };
  const number = (label, key, min, max) => {
    const input = el("input", { type: "number", class: "bpm", min, max, step: 1, "aria-label": label });
    input.addEventListener("change", () => practice.setRamp({ [key]: Number(input.value) }));
    return input;
  };

  const loopText = el("output", { class: "meta loop-text" });
  const snap = ["bar", "beat"].map((mode) => button(mode === "bar" ? "Bar" : "Beat", `Snap the loop to the ${mode}`, () => practice.setSnap(mode)));
  const loopOn = toggle("Loop", "Repeat the range from A to B", () => practice.setLoopOn(practice.state().loopOn !== true));
  const sectionOptions = () => [el("option", { value: "" }, "Loop a section"), ...tl.sections.map((s) => el("option", { value: s.id }, s.name))];
  const sections = el("select", { class: "bpm", "aria-label": "Loop a section" }, ...sectionOptions());
  sections.addEventListener("change", () => {
    if (sections.value) practice.loopSection(sections.value);
    sections.value = "";
  });

  const start = number("Ramp start BPM", "start", 20, 240);
  const step = number("Ramp step BPM", "step", 1, 60);
  const target = number("Ramp target BPM", "target", 20, 240);
  const rampOn = toggle("Ramp", "Raise the tempo after each loop pass", () => practice.setRampOn(practice.state().rampOn !== true));
  const hold = toggle("Hold", "Freeze the ramp at the current tempo", () => practice.setHold(practice.state().hold !== true));
  const message = el("p", { class: "hands-note", role: "status", hidden: true });

  const hands = {};
  const handButtons = [];
  for (const [hand, word] of [["L", "left"], ["R", "right"]]) {
    for (const flag of ["muted", "hidden"]) {
      const verb = flag === "muted" ? "Mute" : "Hide";
      hands[`${hand}.${flag}`] = toggle(`${verb} ${word}`, flag === "muted" ? `Silence the ${word} hand` : `Remove the ${word} hand from the keyboard and the score`, () => practice.toggleHand(hand, flag));
      handButtons.push(hands[`${hand}.${flag}`]);
    }
  }
  const full = toggle("Full 88", "Show all 88 keys instead of the range of this level", () => practice.setFull(practice.state().full !== true));
  const quality = el("select", { class: "bpm", "aria-label": "Graphics quality", title: "Graphics quality of the keyboard view" }, ...QUALITY_CHOICES.map((q) => el("option", { value: q }, QUALITY_LABELS[q])));
  quality.addEventListener("change", () => practice.setQuality(quality.value));

  const row = (...kids) => el("div", { class: "transport-row" }, ...kids);
  const element = el(
    "section",
    { class: "transport practice", "aria-label": "Practice" },
    row(button("Set A here", "Start of the loop at the current position", () => practice.setA()), button("Set B here", "End of the loop at the current position", () => practice.setB()), ...snap, sections, loopOn, loopText),
    row(el("label", { class: "field" }, "Ramp from", start), el("label", { class: "field" }, "by", step), el("label", { class: "field" }, "to", target), rampOn, hold),
    row(...handButtons, full, el("label", { class: "field" }, "Quality", quality)),
    message,
  );

  const press = (b, on) => b.setAttribute("aria-pressed", String(on === true));
  function draw(s) {
    loopText.textContent = formatLoop(s.loop, tl);
    press(loopOn, s.loopOn);
    press(snap[0], s.snap === "bar");
    press(snap[1], s.snap === "beat");
    press(rampOn, s.rampOn);
    press(hold, s.hold);
    hold.disabled = !s.rampOn;
    for (const hand of ["L", "R"]) for (const flag of ["muted", "hidden"]) press(hands[`${hand}.${flag}`], s.hands[hand][flag]);
    press(full, s.full);
    start.value = String(s.ramp.start);
    step.value = String(s.ramp.step);
    target.value = String(s.ramp.target);
    quality.value = s.quality;
    message.textContent = s.message;
    message.hidden = s.message === "";
  }
  const off = practice.subscribe(draw);
  draw(practice.state());

  return {
    element,
    setTimeline(next) {
      tl = next;
      sections.replaceChildren(...sectionOptions());
      draw(practice.state());
    },
    dispose() {
      off();
      element.remove();
    },
  };
}
