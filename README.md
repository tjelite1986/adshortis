# Adshortis

A vertical short-video library for the adult channel: a swipe feed, genre
buckets, creator profiles, playlists, tags, an import folder, an auto-poller and
a duplicate scanner.

It was the `/shorts18` section of elite-v2 until 2026-09-15, when the 18+ channel
was extracted into this app — the same move the main channel made a fortnight
earlier. See [The split](#the-split).

Nothing here names the machine it runs on: the hostnames, the media roots and
the address of the app it borrows its login from all come from the environment.

---

## What it is

| | |
|---|---|
| Stack | Next 15 (App Router), React 19, Tailwind, better-sqlite3 + Kysely |
| Database | one SQLite file, `DATA_DIR/adshortis.db` |
| Media | on disk, under `SHORTS_ROOT` — never in the database |
| Accounts | none of its own; sign-in is elite-v2's (see [Sign-in](#sign-in)) |
| Dev | `npm run dev` → :3040 |

### Pages

| Path | |
|---|---|
| `/` | the immersive feed — swipe, like, comment, save, share |
| `/explore` | the whole library as a grid, filterable by genre |
| `/profiles`, `/profile/<id>` | creators, and one creator's clips |
| `/person/<handle>` | everything one handle covers, across merged aliases |
| `/playlists`, `/playlists/<id>` | saved collections |
| `/tags`, `/tag/<tag>` | hashtags as a catalogue and as a grid |
| `/mine` | the viewer's own uploads, public and private |
| `/analysis` | vision summaries, when they are switched on (see below) |
| `/upload` | one clip at a time |
| `/grab` | pull a clip from a URL (admin) |
| `/settings` | Sources, Import, Duplicates, Cleaning, Titles (admin) |

### Genres

Every clip carries one of `straight / gay / lesbian / trans / solo`, or
`uncategorized` — the inbox a freshly imported clip lands in. Admins sort them
from a pill on the player, a per-tile selector in the grid, or the chips on
`/explore`; any viewer can filter the feed by genre from the player's 3-dot menu.
The filter travels in the URL (`?cat=`), so a reload or a Back lands in the same
slice.

---

## Sign-in

There are no accounts here. elite-v2 scopes its session cookie to the parent
domain, so a browser signed in there arrives here already signed in; the token
behind that cookie is posted to elite-v2's `POST /api/auth/verify`
(`ELITE_VERIFY_URL`, over the internal network) and comes back as
`{id, email, role, username, displayName, avatarUrl}` plus the account's chosen
accent and background, which this app then wears.

Verifying the signature locally would need elite-v2's `JWT_SECRET` and would
still accept a session that had been revoked — that row is in elite-v2's
database. So the token goes back to be resolved, and the secret never leaves the
app that owns it. Answers are cached 30 s (`lib/sso.ts`), so revocation lags by
at most that.

Accounts that have signed in are mirrored into a local `users` table, keyed by
**elite-v2's own id** — the same integer the migrated rows already carry. It
holds a name and an avatar URL so a comment can be rendered without a round
trip. Nothing in it is a credential.

**`ELITE_VERIFY_URL` unset means nobody can sign in**, which is the honest
failure: this app cannot authenticate anyone by itself.

**There is no PIN gate.** In elite-v2 the 18+ section sat behind an optional
per-account PIN, because it shared its address with everything else that account
could see. Standing alone on its own host, the session is the gate: reaching any
page here already means a signed-in account.

### Writes

The session cookie is scoped to the parent domain, and `SameSite=lax` does not
separate this host from any other on it — every page on that domain is the same
site. So `middleware.ts` refuses any non-GET request whose `Origin` is not this
host. Two ways past it, both deliberate: a matching Origin, or `x-admin-token`
(the host timers, which are not browsers and hold a credential no page can
read). **`ADMIN_TOKEN` unset means closed, never open.**

---

## The split

The main channel lives in its own app. Everything here is `18plus` and nothing
can change that: `CHANNEL` in `lib/shorts.ts` is a constant, the feed filters on
it, and the importer no longer reads a channel from the environment. The
`channel` column survives in the schema because the storage keys and the
maintenance scripts resolve paths through it.

Consequences worth knowing:

- **A clip can be handed over, one way.** "Hand over to the main library" drops
  the file into that app's shorts import folder (`HANDOVER_MAIN_DIR`) with the
  bracket naming grammar its importer parses, and soft-deletes the row here.
  That app's timer files it minutes later. Nothing comes back except through its
  own tools. Writing into another app's database from here was the alternative,
  and it would have made two apps owners of one schema.
- **Vision summaries are off until someone says otherwise.** A model key alone
  describes nothing: `lib/short-summary.ts` refuses every clip unless
  `SHORT_AI_SUMMARY_CHANNELS` names a channel. This whole library is the adult
  channel, and sending it to a third-party API is a decision to take
  deliberately rather than inherit from a default.
- **elite-v2 no longer has a shorts section at all.** `/shorts18` there is a
  redirect here, its shorts jobs are gone from the registry, and its per-user
  drop tree no longer offers a shorts folder.

---

## Deploy

```bash
cd <compose dir>
docker compose build && docker compose up -d
```

An image build, not a bind mount: `better-sqlite3` and `sharp` are native and
must be compiled against the image's glibc, and the maintenance scripts run
inside this container (`docker exec`, from the timers) so they need the runtime
`node_modules` and the `ffmpeg` the image carries.

### Storage

Three bind mounts, named by the container path they land on. What they are on
the host is a deployment detail and lives in the compose file, not here.

| In the container | |
|---|---|
| `/shorts-store/18plus` | the library: one flat tree of creator folders, owned by this app alone |
| `/import-store` | per-user drop tree |
| `/handover-main` | the main library's own shorts import folder. One-way, for the handover above |

`PROFILE_ROOT` is **not** mounted. The per-user uploads that arrived with the
migration were merged into the library above (`scripts/merge-user-uploads.mjs`),
so no key resolves outside this app's own tree any more. The root survives in the
code because `isUploadKey()` still routes a stray `u_<user>/` key there — after
the merge there are none, and one that reappears should fail loudly rather than
resolve into a neighbouring app's directory.

### Timers

Installed from `deploy/systemd/`. Each runs a script inside the container.

| Unit | Every | |
|---|---|---|
| `adshortis-import` | 5 min | sort `_import/` into creator folders |
| `adshortis-transcode` | 3 min | `pending` → `.web.mp4` → `ready` |
| `adshortis-poll` | 30 min | fetch new clips for `auto_poll` profiles |
| `adshortis-dupescan` | nightly 05:10 | group duplicates for review; deletes nothing |
| `adshortis-cleanup` | hourly | drop rows whose file is gone, purge emptied playlists |

The unit files ship with `User=CHANGEME` — substitute the account that may talk
to the docker socket before installing them. Left as-is, systemd refuses to
start the unit rather than quietly running it as root.

**A clip dropped in `_import` is invisible for up to eight minutes**, and that
proves nothing about whether it arrived: the importer inserts it `pending`, and
every listing query filters `status = 'ready'`, which the transcoder sets. Check
the row and the disk before concluding anything was lost.

---

## Migration

```bash
docker exec adshortis node scripts/migrate-from-elitev2.mjs /tmp/src.db
docker exec adshortis node scripts/merge-user-uploads.mjs
```

Ids are preserved — a storage key, a like's `user_id` and a playlist's contents
all reference ids from the other side. It is idempotent (`INSERT OR IGNORE`) and
never deletes: a re-run is a top-up, not a mirror.

The source **must** be a snapshot taken with SQLite's `.backup()`. elite-v2 runs
in WAL mode, and a plain `cp` of the `.db` without its `-wal` produces a file
that opens fine and reports zero rows.

The second script is the other half of the same move: it walks every row whose
storage key still points into elite-v2's shared per-user tree, moves the file
into this app's library and rewrites the key. Run it with `PROFILE_ROOT` mounted,
once, and the mount can go.

---

## Environment

| | |
|---|---|
| `ELITE_VERIFY_URL` | where a session token is resolved. Unset = nobody can sign in |
| `ELITE_INTERNAL_URL` | same app over the internal network, for the avatar proxy |
| `ELITE_APP_URL` | public address of that app: the door back, and the only host an avatar URL may come from |
| `MAIN_APP_URL` | the main shorts library, as a menu row |
| `APP_URL` | this app's own address, for the round trip through its sign-in page |
| `ADMIN_TOKEN` | the timers' credential. Unset = the write routes refuse them |
| `SHORTS_ROOT`, `IMPORT_ROOT` | media roots |
| `HANDOVER_MAIN_DIR` | the main library's import folder. Unset = the handover row reports it is unreachable |
| `SHORT_AI_SUMMARY_CHANNELS` | which channels a vision model may describe. Unset = none |
| `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` | vision summaries. Neither = the Analysis page says so |
| `YT_DLP_BIN` | bind-mounted from the host, so it updates without an image rebuild |
