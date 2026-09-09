# Cloud sync

Local-first cloud alignment via Convex. The app never waits on the network:
SQLite stays the single source of truth for everything the app renders, and
the cloud exists only so one user's devices can converge. An account is
optional — the app runs fully offline, fully local, forever.

## Identity

- Convex Auth with two providers configured: **Anonymous** and **Password**
  (`convex/auth.ts`), but only Password sessions sync. A guest is pure
  local — no cloud rows are ever created for it, because an anonymous
  identity is device-bound and unclaimable, so mirroring its rows would buy
  no cross-device value.
- **Binding an email + password** (settings → Account) signs up for or signs
  into the Password account, then pushes the full local snapshot to it — the
  device's SQLite state is what carries across the upgrade. Signing in on a
  second device with the same email merges that account's cloud rows into
  the local state under the rules below.
- Tokens persist in the device keychain via `expo-secure-store`
  (`src/cloud/token-storage.ts`).
- Email verification is intentionally skipped; no mail service is involved.

## Scope

The three bundled word banks never leave the device (they are identical in
every build). The cloud mirrors only user state — `cloud_*` tables in
`convex/schema.ts` mirror `bucket_progress`, `round_word`, `round_history`,
`daily_stat`, `daily_pointer`, `word.flagged`, and `meta`.

## One sync cycle

`SyncProvider` (`src/cloud/sync.tsx`) runs only for a bound account. The
first cycle of a session fires when the bound account becomes ready (auth
and settings may resolve in either order); network regain and app foreground
trigger catch-up cycles, and signing in re-syncs immediately. One cycle is:

1. **Pull** — `sync.pull` returns the user's whole cloud state;
   `applyCloudState` (`src/cloud/mirror.ts`) merges it into SQLite.
2. **Push** — the full local state (`readLocalSnapshot`) is sent to
   `sync.push`, which applies the same merge rules server-side.

Both sides run the same rules, so the two stores converge after any cycle.
`round_word` is compacted on the wire: the cloud keeps **one document per
round** holding only the reached/flagged positions (as two sorted arrays), so
even a 3,120-word round stays a single cloud row instead of 3,120 — and the
server merge is an O(reached) array union, not an O(words²) per-word lookup.
All other tables stay tiny, which buys this full-state simplicity over an op-log.

## Merge rules

| Data | Rule |
| --- | --- |
| `bucket_progress` | round/pointer ride the higher round; `startedAt` last-write-wins by `progress_updated_at` |
| `round_word` | one cloud doc per round; `reached`/`flagged` are position arrays merged by **union** across devices (per-round history is append-only) |
| `round_history` | union; `started_at` min, `finished_at` max |
| `daily_stat` | per metric max (high-water beat; summing would double-count one day used on two devices) |
| `daily_pointer` | `global_position` max (high-water snapshots) |
| `word.flagged` | last-write-wins by `flagged_at` — unflagging propagates; an unflag also clears the current round's `round_word.flagged` |
| `meta` | last-write-wins by `updated_at` |

The timestamp columns (`updated_at`, `flagged_at`, `progress_updated_at`)
exist solely for these rules; local behavior never reads them.

## Decisions & trade-offs

**`cloudRoundWord` is one array doc per round, not one row per word.** The
history heatmap (`stats` screen) renders every past round, so its per-round
shape must survive a reinstall or a second device — that portability is the
reason the table exists at all. Two cheaper alternatives were considered and
rejected:

- **Drop `cloudRoundWord` entirely** (keep only `cloudBucketProgress` + the
  `word.flagged` mirror). Simplest, but a fresh device would lose all past
  round heatmaps and have to re-learn to rebuild them. Rejected because the
  user cares about history portability.
- **Keep per-word rows but add a `position` index.** This fixes the O(words²)
  server read blow-up (the `Too many documents read` crash at ~254 words/round)
  but leaves the table growing without bound — thousands of rows per round, and
  `pull` would later hit the *same* 32k read ceiling re-collecting it.

The array form fixes both: cloud rows drop ~3120× per round, the server merge
is a single `.unique()` lookup plus an array union, and `pull` no longer
re-collects thousands of rows. The `stats` heatmap and all local UI are
unchanged — only the on-the-wire / cloud representation differs.

**Push and pull are still full-state.** Compaction cuts *per-round* size and
server reads, but `readLocalSnapshot` still ships **every** round and `pull`
still collects the user's whole cloud state each cycle. At current volumes that
is fine; once a user accrues many rounds (hundreds) the full push approaches
request-size limits and becomes wasteful. **Incremental sync** — a sync cursor
tracking `updatedAt` per entity, pushing/pulling only changes since the last
cycle (with `round_word` changes keyed by round) — is the planned next step and
a separate change, not part of this compaction.

## Setup

```bash
npx convex dev                  # first run: creates/links a project, generates
                                # convex/_generated, pushes functions
node scripts/set-auth-keys.mjs  # writes the JWT signing keys to the linked
                                # deployment (add --prod for production)
```

The key step is mandatory: without `JWT_PRIVATE_KEY`/`JWKS` on the
deployment every sign-in fails with "Missing environment variable
JWT_PRIVATE_KEY". Neither step is needed to run or build the app itself —
only to change backend code or set up a new deployment.

Then put the printed deployment URL in `.env.local`:

```
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
```

Without `EXPO_PUBLIC_CONVEX_URL` the app is exactly the local-only build —
no cloud provider mounts. `npx tsc` excludes `convex/` until the first
`npx convex dev` generates `_generated`; the Convex CLI typechecks functions
on every push.

## Known limitations

- "Clear all data" for a bound account wipes the cloud copy first (offline it
  aborts instead of half-clearing), then resets SQLite and signs out.
- `daily_stat` merging keeps the max per metric, so the same wall-clock minute
  used on two devices counts once — conservative by design.
- The engine is single-user by construction; there is no sharing or
  multi-device conflict UI — conflicts resolve silently by the rules above.
- **Schema migration note:** `cloudRoundWord` changed shape (per-word rows →
  one array doc per round). Deploying the new backend leaves the old per-word
  documents behind, which the new reader cannot interpret — after `npx convex
  dev`, wipe the cloud once (`npx convex run sync:resetAll '{}'` in dev, or
  Settings → Account → Clear all data from the app) so the table starts clean.
