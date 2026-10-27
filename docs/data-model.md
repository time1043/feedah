# Data model

Single SQLite database (`feedah.db`, WAL, foreign keys ON). The schema is
declared with drizzle-orm in `src/db/schema.ts`; migrations are generated
with `pnpm db:generate` into `drizzle/` and applied by the drizzle migrator
on first open. Bundled buckets are seeded from `src/mock/data.ts`
(idempotent — a bucket is re-seeded only when its word count changes).

## Tables

| Table             | Purpose                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `bucket`          | id (the display name, e.g. `2050`) and word count — the anchor of the global position math |
| `word`            | one row per word: bucket, position (1-based), text, ipa, meaning, forms (JSON)             |
| `bucket_progress` | the probe: current `round`, `pointer` (0-based card index), `round_started_at`             |
| `round_flag`      | per (bucket, round, position): the round's flag list, sparse (unflag deletes the row)      |
| `round_history`   | finished rounds: started_at, finished_at                                                   |
| `review_session`  | review walk-throughs of one round's flag list (see lifecycle below)                        |
| `daily_pointer`   | per (day, bucket): end-of-day global position watermark                                    |
| `daily_stat`      | per day: `feed_seconds`, `app_seconds`                                                     |

Display preferences (theme, HUD toggles, search scope, words-meaning) live in
AsyncStorage via jotai atoms instead — they reference no DB entity and never
sync. `activeBucket` is the one AsyncStorage key that names a DB entity;
when user-imported buckets arrive it must move into the database.

## Semantics

**Probe** — each bucket has exactly one probe: its current feed round and the
card currently in progress. Landing on a card completes the one before it, so
`pointer` doubles as the resume index. It only moves forward, only on hand
settlements in study mode (scrubbing flips the feed into browse mode, which
records nothing; "Resume studying" returns to the frontier). Completing the
end card archives the round into `round_history` and opens the next one — in
the same transaction, so no "walked through but not advanced" state exists.

**Reached is derived, never stored** — exposure semantics: a word is reached
when the pointer has swept over it (`position <= pointer`, or the round is
finished). Skipped-over words count, on purpose: this is the same yardstick
the daily word count uses, so the green bar and the stats can never disagree.
This depends on the settle invariant above; if feed navigation ever changes,
revisit this.

**Per-round flag lists** — every round of a bucket has an independent flag
list (`round1_flag`, `round2_flag`, …). The round of a flag write is always
passed in explicitly by the caller: the feed targets the probe's round, a
review targets its own round, and a browse opened from a review inherits that
round. The repo refuses to write a future round and never derives the round
itself (an MVP bug this rule precludes).

**Review sessions** — a review is a walk over one round's full flag list,
snapshotted (frozen) into the session row at creation; flag edits never
rewrite an in-flight walk. Lifecycle:

| Feed of that round | Open session | Behavior                                |
| ------------------ | ------------ | --------------------------------------- |
| unfinished         | open draft   | resume (cursor kept)                    |
| unfinished         | none         | new draft (`number = null`)             |
| finished           | open draft   | discard it, start real `time {n+1}`     |
| finished           | open counted | resume                                  |
| finished           | none         | drafts zeroed (抹零), real `time {n+1}` |

A draft is never promoted: its snapshot predates the finished round, so it
"strictly wasn't a completed review" — the first real `time 1` happens after
the feed completes. Drafts are local scratch (never synced), at most one per
round (partial unique index), and deleted when finished. Counted sessions are
archived with their finish time and their `number` is stored, immutable.
`last_position` is a monotonic word-position watermark; resume lands on the
first queue word at or after it.

**Daily words** — each pointer advance upserts the day's `daily_pointer`
snapshot; a day's count is the difference between consecutive snapshots
summed across buckets (`lib/daily.ts`). Re-viewing cards cannot inflate it.
Review activity derives from `review_session` timestamps, grouped by the
local day of `started_at`.

**Daily time** — `app_seconds` (app foreground and active) and
`feed_seconds` (feed/review decks focused and active) accumulate in memory
and flush on settles, app-state changes, and a 10 s interval.
