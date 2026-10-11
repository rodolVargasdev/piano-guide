// Pure guards for the private song library, shared by the privacy tests. Each guard takes plain
// data so a test can run it on a repository fixture and on a deliberately broken one (counter-proof).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const PRIVATE_DIR = "songs-private/";

/** True when a .gitignore or .dockerignore text has a line for the private folder. */
export function ignoresPrivateFolder(text) {
  return text.split(/\r?\n/).some((line) => line.trim().replace(/^\//, "") === PRIVATE_DIR);
}

/** The tracked paths that live under the private folder (must be empty). */
export function privatePathsIn(paths) {
  return paths.filter((p) => p.replaceAll("\\", "/").replace(/^\.\//, "").startsWith(PRIVATE_DIR));
}

/** The `file` values of a public index that mention the private folder (must be empty). */
export function privateRefsInIndex(index) {
  return (index?.songs ?? []).map((e) => e?.file).filter((f) => typeof f === "string" && f.includes("songs-private"));
}

/** True when a song file declares itself private (a file under songs/ must not). */
export const declaresPrivate = (song) => song?.visibility === "private";

/**
 * Tracked paths from `git ls-files -z`, run in `repoRoot` (taken from the test file's own URL, never
 * from input) with no shell. Returns { skipped: reason } when there is no `.git` (the Docker build
 * stage) or git cannot run, so the check is skipped with a visible reason instead of passing blindly.
 */
export function trackedPaths(repoRoot) {
  if (!existsSync(join(repoRoot, ".git"))) return { skipped: "no .git directory (for example the Docker build stage)" };
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) return { skipped: `git ls-files could not run (${r.error?.code ?? `exit ${r.status}`})` };
  return { paths: r.stdout.split("\0").filter(Boolean) };
}
