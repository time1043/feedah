# v0.0.3

Coming back to the app no longer freezes your taps, word pages answer
immediately, round history shows real dates, and syncing is more robust for
long-running progress. Plus a new app icon.

## Returning to the app without the freeze

- Resuming the app used to lock up taps for a few seconds while sync ran on
  the same thread that handles touches. Sync now starts 1.5 seconds after
  you return, runs one at a time, and merges in memory with batched writes
  instead of round-tripping per word row — your first taps land instantly.
- A failed push no longer replays the same cloud changes every time you
  return to the app.

## Word pages answer immediately

- The words list shows a spinner while it first loads, and a word page
  shows one while its content prepares — the wait is visible instead of
  feeling like a dead tap.
- Tapping faster than the app can respond no longer stacks duplicate word
  pages: taps that queue up in a fraction of a second open one page, not
  one per tap.

## Round history with real dates

- Each round in stats now shows its start date and how long it ran, e.g.
  "Round 2 · 2026-09-01 · 14d · 87".
- Rounds started while an earlier date bug was live get their true start
  date recovered from your review history, and that date syncs to your
  other devices.

## Sync fixes for long-running progress

- Flagging many words no longer makes pushes fail on the cloud's
  32,000-document read limit.
- Round history is now synced and backfilled, and a round's start date
  survives cloud merges instead of resetting to "now".

## New app icon

- The placeholder icon is replaced with the brand mark on black.

## Under the hood

- A large expansion of automated test coverage: Jest suites across the
  database, cloud sync, and app logic, mirroring the src tree.
