// Zero-dependency static dev server. Usage: PORT=8790 node tools/serve.mjs
// NO_PRIVATE=1 answers 404 under /songs-private/ (to rehearse the GitHub Pages behavior locally without moving
// files). /songs-private/sources/ (the raw captures) is never served, with or without that switch.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, extname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT) || 8790;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

// The sample files never change under the same name (their hashes are pinned): cache them for a year. Everything else is not stored.
const AUDIO_PREFIX = "/assets/audio/";
const cacheControlFor = (pathname) => (pathname.startsWith(AUDIO_PREFIX) ? "public, max-age=31536000, immutable" : "no-store");

// Returns the absolute path inside `root`, or a numeric HTTP status on rejection.
export function resolveRequestPath(urlPath, root = ROOT) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return 400;
  }
  if (decoded.includes("\0")) return 400;
  const full = resolve(join(root, decoded));
  if (full !== root && !full.startsWith(root + sep)) return 403;
  return full;
}

// A path segment as the file system reads it: the dev machine is Windows, where a name is case-insensitive,
// trailing dots and spaces are ignored and an alternate data stream hangs after a colon.
const folded = (segment) => segment.split(":")[0].replace(/[. ]+$/, "").toLowerCase();

/**
 * True when the server must answer 404 for this absolute path: anything under songs-private/sources/ always,
 * and anything under songs-private/ when `noPrivate` is on.
 */
export function isHidden(fullPath, { root = ROOT, noPrivate = false } = {}) {
  const parts = relative(root, fullPath).split(sep).map(folded);
  if (parts[0] !== "songs-private") return false;
  return noPrivate || parts[1] === "sources";
}

/** The dev server as an object, so a test can listen on an ephemeral port. */
export function createDevServer({ root = ROOT, noPrivate = process.env.NO_PRIVATE === "1" } = {}) {
  return createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const target = resolveRequestPath(pathname, root);
    if (typeof target === "number") {
      res.writeHead(target, { "Content-Type": "text/plain" });
      res.end(target === 403 ? "Forbidden" : "Bad request");
      return;
    }
    try {
      if (isHidden(target, { root, noPrivate })) throw new Error("hidden");
      let file = target;
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      if (isHidden(file, { root, noPrivate })) throw new Error("hidden");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": cacheControlFor(pathname),
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });
}

// Listen only when run as a script, never when a test imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createDevServer().listen(PORT, "127.0.0.1", () => {
    console.log(`piano-guide dev server on http://localhost:${PORT}/${process.env.NO_PRIVATE === "1" ? " (private library hidden)" : ""}`);
  });
}
