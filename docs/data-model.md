# Data model

Single SQLite database (`feedah.db`, WAL mode). The schema is declared with
drizzle-orm in `src/db/schema.ts`; migrations are generated with `pnpm
db:generate` into `drizzle/` and applied by the drizzle migrator on first
open. Databases created before drizzle are detected once (app tables present
but no `__drizzle_migrations`) and deleted — local state is disposable.
Bundled buckets are then seeded from `data/*.json` (idempotent, re-seeded
when a bucket's word count changes).

User-state rows carry sync timestamps (`updated_at`, `flagged_at`,
`progress_updated_at`) used only by the optional cloud sync — local behavior
never reads them (see docs/cloud-sync.md for the mirror and merge rules).

## Tables

| Table | Purpose |
| --- | --- |
| `bucket` | id (`2050` / `700` / `370`) and word count |
| `word` | bucket, position (1-based), text, ipa, meaning, forms (JSON), flagged |
| `bucket_progress` | per bucket: current `round`, `pointer`, round `started_at` |
| `round_word` | per (bucket, round, position): `reached`, `flagged`, `reached_at` |
| `round_history` | finished rounds: started_at, finished_at |
| `daily_stat` | per day: `feed_seconds`, `app_seconds` |
| `daily_pointer` | per (day, bucket): end-of-day global position snapshot |
| `meta` | key-value store (active bucket, settings) |

## Semantics

**Pointer** — high-water mark within the current round. It only moves forward:
never on review, never on jumps. Global position is
`(round - 1) * word_count + pointer`.

**round_word** — `reached = 1` means the card was settled by hand in that
round; jump targets never count. `reached_at` records when it was completed
(0 means it cannot be attributed to a day — this powers the day review).
`flagged = 1` means the bookmark was on at
some point during the round; the row may exist with `reached = 0` when a word
was flagged without being reached (e.g. from search). Unflagging only rewrites
the current round's rows — finished rounds are never rewritten.

**Rounds** — `startNextRound` is idempotent and only advances from a fully
walked-through round (`pointer == word_count`); it writes a `round_history`
row and resets the pointer to 0.

**Daily word count** — never derived from per-card events. Each pointer
advance upserts the day's `daily_pointer` snapshot; a day's count is the
difference between its snapshot and the previous recorded one, summed across
buckets (see `lib/daily.ts`). Re-viewing cards therefore cannot inflate counts.

**Daily time** — two overlapping metrics: `app_seconds` (app foreground and
active) and `feed_seconds` (feed screen focused and active). Time accumulates
in memory and is flushed to `daily_stat` on card settles, app-state changes,
and a 10 s interval, so a crash loses at most one interval.

**Settings** — stored as JSON strings in `meta`, loaded once by
`SettingsProvider`, written through optimistically on every change.
