import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guards for the documents the Learn mode change promises. Each guard takes plain text, so a test can run
// it on the real file and on a deliberately broken fixture (counter-proof). The Docker test stage copies
// README.md and docs/USABILITY_CHECK.md for this file.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");

/** What is wrong with a usability protocol text (an empty list means it is complete). */
export function usabilityProblems(doc) {
  const problems = [];
  if (!/^Revised on: \d{4}-\d{2}-\d{2}/m.test(doc)) problems.push("no 'Revised on' line");
  const thresholds = doc.slice(doc.indexOf("## Pass thresholds"));
  for (const id of ["T1", "T2", "T3", "T4", "T5"]) {
    const task = new RegExp(`^\\| ${id}\\b[^\\n]*`, "m").exec(doc.slice(0, doc.indexOf("## What to record")))?.[0];
    if (!task) problems.push(`${id} is not in the task table`);
    else if (!/\d+ min/.test(task)) problems.push(`${id} has no time limit`);
    if (!new RegExp(`^\\| ${id}\\b[^\\n]*\\d+ min|^\\| ${id}\\b[^\\n]*\\| 0 \\|`, "m").test(thresholds)) problems.push(`${id} has no pass threshold`);
  }
  // Every task is available since Milestone C: lesson zero (T1), the private song (T2), Ode to Joy (T3), resuming (T4) and the routine (T5).
  for (const id of ["T1", "T2", "T3", "T4", "T5"]) {
    const row = new RegExp(`^\\| ${id}\\b[^\\n]*`, "m").exec(doc)?.[0] ?? "";
    if (!/\| now\b/.test(row)) problems.push(`${id} is not marked as available now`);
  }
  if (!/^### T5: the 10-minute routine/m.test(doc)) problems.push("no T5 routine instructions");
  for (const field of ["which blocks were done and which were skipped", "Listen", "clean run", "Suggested fingering"]) {
    if (!doc.includes(field)) problems.push(`T5 does not record: ${field}`);
  }
  if (!/does not (?:explain|help)|Do not explain/i.test(doc)) problems.push("no rule that the observer does not help");
  if (!/hesitations? (?:longer than|over) 10 seconds|hesitations over 10 s/i.test(doc)) problems.push("hesitations over 10 seconds are not recorded");
  return problems;
}

/** What is wrong with a README text for the Learn mode change. */
export function readmeProblems(readme) {
  const problems = [];
  if (!readme.includes("docs/USABILITY_CHECK.md")) problems.push("does not link docs/USABILITY_CHECK.md");
  if (!readme.includes("USB TO HOST")) problems.push("no Casio USB TO HOST setup");
  if (!readme.includes("Connect piano")) problems.push("no Connect piano instruction");
  if (!readme.includes("songs-private") || !/-v <path>\/songs-private:\/usr\/share\/nginx\/html\/songs-private:ro/.test(readme)) problems.push("no read-only mount command for the private folder");
  if (!readme.includes("node tools/convert-hooktheory.mjs")) problems.push("no converter command");
  if (!readme.includes("`A S D F G H J K L ; '`")) problems.push("the computer key map is not documented");
  // Practice exercises (Milestone C): the section, its parts and the routes.
  if (!/^## Practice exercises$/m.test(readme)) problems.push("no Practice exercises section");
  for (const part of ["Today", "Doc card", "Metronome", "Ear drills", "10-minute routine", "Skip block", "Reset progress", "Suggested fingering", "days in a row"]) {
    if (!readme.slice(readme.indexOf("## Practice exercises")).includes(part)) problems.push(`the Practice exercises section does not mention ${part}`);
  }
  for (const route of ["`#/practice`", "`#/practice/<id>`"]) if (!readme.includes(route)) problems.push(`the routes table does not list ${route}`);
  for (const id of ["five-finger", "scale-major", "triads", "arpeggios", "cadence-i-iv-v-i", "progression-i-vi-iv-v", "progression-i-v-vi-iv", "ear-intervals", "ear-chords", "routine"]) {
    if (!readme.includes(id)) problems.push(`the exercise id ${id} is not documented`);
  }
  if (!/Docker \(primary\)/.test(readme)) problems.push("Docker is not presented as the primary path");
  return problems;
}

test("the usability protocol has T1 to T5 with limits and thresholds, availability notes, the observer rule and a revision line", () => {
  assert.deepEqual(usabilityProblems(read("docs/USABILITY_CHECK.md")), []);
});

test("counter-proof: a protocol without T3, without a threshold row or without the revision line is rejected", () => {
  const doc = read("docs/USABILITY_CHECK.md");
  assert.ok(usabilityProblems(doc.replace(/^\| T3\b[^\n]*\n/gm, "")).some((p) => p.startsWith("T3")));
  assert.ok(usabilityProblems(doc.replace(/^Revised on:[^\n]*\n/m, "")).includes("no 'Revised on' line"));
  assert.ok(usabilityProblems(doc.replace(/^(\| T3\b[^\n]*)\| now /m, "$1| after Milestone B ")).includes("T3 is not marked as available now"));
  assert.ok(usabilityProblems(doc.replace(/^(\| T5\b[^\n]*)\| now /m, "$1| after Milestone C ")).includes("T5 is not marked as available now"));
  for (const id of ["T1", "T2", "T3", "T4", "T5"]) assert.match(doc, new RegExp(`^\\| ${id}\\b[^\\n]*\\| now\\b`, "m"), `${id} is available now`);
  assert.ok(usabilityProblems(doc.replace("### T5: the 10-minute routine", "### T5")).includes("no T5 routine instructions"));
  assert.ok(usabilityProblems(doc.replace("which blocks were done and which were skipped", "which blocks")).includes("T5 does not record: which blocks were done and which were skipped"));
  assert.ok(usabilityProblems(doc.slice(0, doc.indexOf("## Pass thresholds"))).some((p) => p.includes("pass threshold")));
  assert.ok(usabilityProblems("").length >= 5);
});

test("the README links the protocol and documents the inputs, the Casio setup, the mount and the converter", () => {
  assert.deepEqual(readmeProblems(read("README.md")), []);
});

test("counter-proof: a README missing the link, the mount command or the key map is rejected", () => {
  const readme = read("README.md");
  assert.deepEqual(readmeProblems(readme.replaceAll("docs/USABILITY_CHECK.md", "docs/other.md")), ["does not link docs/USABILITY_CHECK.md"]);
  assert.ok(readmeProblems(readme.replace(":ro", "")).includes("no read-only mount command for the private folder"));
  assert.ok(readmeProblems(readme.replace("`A S D F G H J K L ; '`", "the home row")).includes("the computer key map is not documented"));
  assert.ok(readmeProblems(readme.replace("Run with Docker (primary)", "Run")).includes("Docker is not presented as the primary path"));
  assert.ok(readmeProblems(readme.replace("## Practice exercises", "## Practice")).includes("no Practice exercises section"));
  assert.ok(readmeProblems(readme.replaceAll("Skip block", "Skip")).includes("the Practice exercises section does not mention Skip block"));
  assert.ok(readmeProblems(readme.replace("| `#/practice/<id>` |", "| `#/practice/x` |")).includes("the routes table does not list `#/practice/<id>`"));
  assert.ok(readmeProblems(readme.replace("ear-chords", "ear-x")).includes("the exercise id ear-chords is not documented"));
});
