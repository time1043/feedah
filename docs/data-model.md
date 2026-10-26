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

| Table             | Purpose                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `bucket`          | id, word count, `source` (builtin/custom), `name`, `kind` (word/qa), `language`, `created_at` |
| `word`            | bucket, position (1-based), text, ipa, meaning, forms (JSON), flagged |
| `bucket_progress` | per bucket: current `round`, `pointer`, round `started_at`            |
| `round_word`      | per (bucket, round, position): `reached`, `flagged`, `wrong`, `reached_at` |
| `round_history`   | finished rounds: started_at, finished_at                              |
| `daily_stat`      | per day: `feed_seconds`, `app_seconds`                                |
| `daily_pointer`   | per (day, bucket): end-of-day global position snapshot                |
| `meta`            | key-value store (active bucket, settings)                             |
| `review_cursor`   | per review session key: furthest card settled — local only, never synced |

## Semantics

**Pointer** — high-water mark within the current round. It only moves forward:
never on review, never on jumps. Global position is
`(round - 1) * word_count + pointer`.

**round_word** — `reached = 1` means the card was settled by hand in that
round; jump targets never count. `reached_at` records when it was completed
(informational only — it never syncs, so the day review cannot rely on it).
`flagged = 1` means the bookmark was on at
some point during the round; the row may exist with `reached = 0` when a word
was flagged without being reached (e.g. from search). Unflagging only rewrites
the current round's rows — finished rounds are never rewritten.

**Rounds** — `startNextRound` is idempotent and only advances from a fully
walked-through round (`pointer == word_count`); it writes a `round_history`
row and resets the pointer to 0.

**wrong** — answer-driven modes (multiple choice) record their judgement on
the round's row: `wrong = 1` when the first-pass answer was incorrect. A
plain settle never rewrites it, so re-visiting a card cannot downgrade it.
It syncs as a third per-round position array with the same union merge as
`reached`/`flagged`.

**Custom buckets** — imported on the buckets page (`src/lib/bucket-file.ts`
parses and validates the JSON). A replace renumbers positions, so every
position-keyed row would point at different content: `round_word`,
`round_history` and the bucket's review cursors reset and progress goes back
to round 1, while day-scoped `daily_stat`/`daily_pointer` stay. The bucket's
cloud rows are wiped first (`sync.wipeMyBucketData`) - the merge rules are
monotonic, so a local-only reset would be resurrected by the next pull.
Deleting a custom bucket cascades the same rows plus the bucket itself.

**Daily word count** — never derived from per-card events. Each pointer
advance upserts the day's `daily_pointer` snapshot; a day's count is the
difference between its snapshot and the previous recorded one, summed across
buckets (see `lib/daily.ts`). Re-viewing cards therefore cannot inflate counts.
The day review reads the same deltas, so its queue always matches the number
and survives reinstalls — the snapshots sync row-for-row, per-word timestamps
do not.

**Daily time** — two overlapping metrics: `app_seconds` (app foreground and
active) and `feed_seconds` (feed screen focused and active). Time accumulates
in memory and is flushed to `daily_stat` on card settles, app-state changes,
and a 10 s interval, so a crash loses at most one interval.

**Settings** — stored as JSON strings in `meta`, loaded once by
`SettingsProvider`, written through optimistically on every change.
