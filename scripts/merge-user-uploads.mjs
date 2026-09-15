#!/usr/bin/env node
// One-off: merge the per-user upload tree into this app's own library.
//
//   node scripts/merge-user-uploads.mjs [--dry-run]
//
// elite-v2 kept an account's own uploads under <PROFILE_ROOT>/u_<user>/shorts18/
// and everything imported or auto-polled under <SHORTS_ROOT>/18plus/. Migrating
// the rows brought both kinds of storage key across, but only one of those trees
// moves with this app — so a key of the form
//
//   u_<user>/shorts18/<creator>/<file>
//
// would resolve into a directory owned by another application. This walks every
// such row, moves its video and poster into <SHORTS_ROOT>/18plus/<creator>/ and
// rewrites the key to the plain form. Afterwards the library is one tree with
// one owner, and PROFILE_ROOT can stop being mounted here at all.
//
// Idempotent and non-destructive:
//   - a row whose key is already plain is skipped;
//   - a source file that is gone while the destination exists counts as done;
//   - a name that is already taken gets a suffix rather than overwriting;
//   - nothing is deleted — the move is rename(2), or copy + unlink across
//     devices, and the row is only updated once the file has landed.
//
// --dry-run reports what it would do and writes nothing.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DRY = process.argv.includes("--dry-run");
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DB_PATH = path.join(DATA_DIR, "adshortis.db");
const SHORTS_ROOT = process.env.SHORTS_ROOT || path.join(DATA_DIR, "shorts");
const PROFILE_ROOT = process.env.PROFILE_ROOT || path.join(DATA_DIR, "profile");
const CHANNEL_DIR = path.join(SHORTS_ROOT, "18plus");

const log = (m) => console.log(`[merge] ${m}`);

// The prefix this rewrites away: u_<user>/shorts18/ (elite-v2 also had a
// u_<user>/shorts/ form for the main channel, which is not this app's to touch).
const UPLOAD_KEY = /^u_[^/]+\/shorts18\/(.+)$/;

// A media root that reads as empty is almost always an unmounted volume, and
// treating that as "every file is missing" would rewrite the whole library's
// keys to point at files this app then could not find.
function rootPopulated(dir) {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

if (!rootPopulated(PROFILE_ROOT)) {
  console.error(
    `PROFILE_ROOT (${PROFILE_ROOT}) is empty or missing — mount it before running this.`
  );
  process.exit(1);
}
if (!rootPopulated(CHANNEL_DIR)) {
  console.error(
    `SHORTS_ROOT/18plus (${CHANNEL_DIR}) is empty or missing — mount it before running this.`
  );
  process.exit(1);
}

// rename(2) fails with EXDEV between two bind mounts, so a cross-device move is
// a copy followed by an unlink — the unlink only after the copy is complete, so
// an interrupted move leaves a duplicate rather than nothing.
function moveFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}

// A free destination key. The extension is kept whole (.web.mp4 is two dots).
function freeKey(relKey) {
  if (!fs.existsSync(path.join(CHANNEL_DIR, relKey))) return relKey;
  const dir = path.dirname(relKey);
  const base = path.basename(relKey);
  const ext = base.toLowerCase().endsWith(".web.mp4")
    ? ".web.mp4"
    : path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  let key;
  do {
    key = path.join(dir, `${stem}_${randomUUID().slice(0, 8)}${ext}`);
  } while (fs.existsSync(path.join(CHANNEL_DIR, key)));
  return key;
}

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 30000");

const rows = db
  .prepare(
    `SELECT id, storage_key, poster_key FROM shorts
      WHERE storage_key GLOB 'u_*/shorts18/*'
         OR poster_key GLOB 'u_*/shorts18/*'`
  )
  .all();

log(`${rows.length} clips carry a per-user key`);

const update = db.prepare(
  "UPDATE shorts SET storage_key = ?, poster_key = ? WHERE id = ?"
);

let moved = 0;
let already = 0;
let missing = 0;
const problems = [];

for (const row of rows) {
  // Resolve one key: returns the new relative key, or null when this key is not
  // a per-user one (it is already where it belongs).
  const resolve = (key, kind) => {
    if (!key) return { key, changed: false };
    const m = UPLOAD_KEY.exec(key);
    if (!m) return { key, changed: false };
    const rest = m[1];
    const src = path.join(PROFILE_ROOT, key);
    if (!fs.existsSync(src)) {
      // Gone from the source. If the plain key already resolves, an earlier run
      // moved it and only the row is behind; otherwise the file is simply lost
      // and the key is left alone for the maintenance sweep to report.
      if (fs.existsSync(path.join(CHANNEL_DIR, rest))) {
        already++;
        return { key: rest, changed: true };
      }
      missing++;
      problems.push(`#${row.id} ${kind}: source missing (${key})`);
      return { key, changed: false };
    }
    const dest = freeKey(rest);
    if (!DRY) moveFile(src, path.join(CHANNEL_DIR, dest));
    moved++;
    return { key: dest, changed: true };
  };

  const video = resolve(row.storage_key, "video");
  const poster = resolve(row.poster_key, "poster");
  if ((video.changed || poster.changed) && !DRY) {
    update.run(video.key, poster.key, row.id);
  }
}

log(`${moved} files moved, ${already} already in place, ${missing} missing`);
for (const p of problems.slice(0, 20)) log(p);
if (problems.length > 20) log(`… and ${problems.length - 20} more`);

const left = db
  .prepare(
    "SELECT COUNT(*) AS c FROM shorts WHERE storage_key GLOB 'u_*/shorts18/*'"
  )
  .get().c;
log(DRY ? `dry run — ${left} rows would remain` : `${left} per-user keys remain`);
