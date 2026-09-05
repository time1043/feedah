# Cloud sync

Local-first cloud alignment via Convex. The app never waits on the network:
SQLite stays the single source of truth for everything the app renders, and
the cloud exists only so one user's devices can converge. An account is
optional — the app runs fully offline, fully local, forever.

## Identity

- Convex Auth with two providers: **Anonymous** and **Password**
  (`convex/auth.ts`). A device signs in anonymously on its first online
  moment; no registration is ever required.
- **Upgrade, not migration**: binding an email + password (settings →
  Account) signs the *same* user up with the Password provider, so all cloud
  rows stay with that user. Signing in on a second device with the same
  email adopts that user's cloud rows.
- Tokens persist in the device keychain via `expo-secure-store`
  (`src/cloud/token-storage.ts`).
- Email verification is intentionally skipped; no mail service is involved.

## Scope

The three bundled word banks never leave the device (they are identical in
every build). The cloud mirrors only user state — `cloud_*` tables in
`convex/schema.ts` mirror `bucket_progress`, `round_word`, `round_history`,
`daily_stat`, `daily_pointer`, `word.flagged`, and `meta`.

## One sync cycle

`SyncProvider` (`src/cloud/sync.tsx`) triggers on app start (once auth
resolves), network regain, and app foreground; the settings screen has a
manual "Sync now". One cycle is:

1. **Pull** — `sync.pull` returns the user's whole cloud state;
   `applyCloudState` (`src/cloud/mirror.ts`) merges it into SQLite.
2. **Push** — the full local state (`readLocalSnapshot`) is sent to
   `sync.push`, which applies the same merge rules server-side.

Both sides run the same rules, so the two stores converge after any cycle.
Data volumes are tiny (hundreds of rows), which buys this full-state
simplicity over an op-log.

## Merge rules

| Data | Rule |
| --- | --- |
| `bucket_progress` | round/pointer ride the higher round; `startedAt` last-write-wins by `progress_updated_at` |
| `round_word` | `reached` OR, `reached_at` max, `flagged` OR (per-round history is append-only) |
| `round_history` | union; `started_at` min, `finished_at` max |
| `daily_stat` | per metric max (high-water beat; summing would double-count one day used on two devices) |
| `daily_pointer` | `global_position` max (high-water snapshots) |
| `word.flagged` | last-write-wins by `flagged_at` — unflagging propagates; an unflag also clears the current round's `round_word.flagged` |
| `meta` | last-write-wins by `updated_at` |

The timestamp columns (`updated_at`, `flagged_at`, `progress_updated_at`)
exist solely for these rules; local behavior never reads them.

## Setup

```bash
npx convex dev        # first run: creates/links a project, generates
                      # convex/_generated, pushes functions
```

Then put the printed deployment URL in `.env.local`:

```
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
```

Without `EXPO_PUBLIC_CONVEX_URL` the app is exactly the local-only build —
no cloud provider mounts. `npx tsc` excludes `convex/` until the first
`npx convex dev` generates `_generated`; the Convex CLI typechecks functions
on every push.

## Known limitations

- "Clear all data" wipes only SQLite; the next sync re-pulls the cloud state.
- `daily_stat` merging keeps the max per metric, so the same wall-clock minute
  used on two devices counts once — conservative by design.
- The engine is single-user by construction; there is no sharing or
  multi-device conflict UI — conflicts resolve silently by the rules above.
