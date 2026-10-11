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
  for (const id of ["T1", "T3", "T5"]) {
    const row = new RegExp(`^\\| ${id}\\b[^\\n]*`, "m").exec(doc)?.[0] ?? "";
    if (!/after Milestone [BC]/.test(row)) problems.push(`${id} is not marked as available after its milestone`);
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
  assert.ok(usabilityProblems(doc.replace("after Milestone B (Ode to Joy)", "now")).some((p) => p.includes("T3")));
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
});
