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

/** True when a .dockerignore text has a line for the private folder, with or without a slash on either side. */
export function dockerignoresPrivateFolder(text) {
  return text.split(/\r?\n/).some((line) => line.trim().replace(/^\//, "").replace(/\/$/, "") === "songs-private");
}

/** The COPY or ADD lines of a Dockerfile text that name the private folder (must be empty). */
export function dockerfilePrivateCopies(text) {
  return text.split(/\r?\n/).filter((line) => /^\s*(COPY|ADD)\b/i.test(line) && line.includes("songs-private"));
}

/** True when an nginx config text answers 404 for the private sources folder. */
export function nginxHidesSources(text) {
  return /location\s+\^~\s+\/songs-private\/sources\/\s*\{\s*return\s+404;\s*\}/.test(text);
}

/**
 * Title-level markers of the private song: its title and its artist. Never a note, a chord or a lyric:
 * the guard only has to know the NAME of what must not appear in the public library.
 */
export const PRIVATE_SONG_MARKERS = [/cancer/i, /my chemical romance/i];

/**
 * The id, title, composer and file values of a public song or index (at any depth) that carry a marker of
 * the private song. Must be empty for every file under songs/.
 */
export function publicDataNamingPrivateSong(node, out = []) {
  if (Array.isArray(node)) node.forEach((x) => publicDataNamingPrivateSong(x, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (["id", "title", "composer", "file"].includes(key) && typeof value === "string" && PRIVATE_SONG_MARKERS.some((m) => m.test(value))) out.push(`${key}: ${value}`);
      else publicDataNamingPrivateSong(value, out);
    }
  }
  return out;
}
