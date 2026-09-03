# Feature spec

The product contract behind the screens. Any code change that alters these
rules is a product change, not a refactor.

## Home

- Bucket chips (three fixed buckets, fully isolated progress), current round,
  big `pointer / word_count` readout, Start/Continue button, search entry.

## Feed (the core)

- Fullscreen, no tab bar. One card per page, swipe up / down.
- Card layout: position number (large), the word, a fixed-height slot for the
  meaning in the top half; word forms in the bottom half; bookmark at the
  bottom. Slots are fixed so toggling never shifts the layout.
- Tap the word → replay pronunciation. Tap anywhere else → toggle meaning and
  forms. Bookmark → flag the word as unfamiliar.
- **Counting**: the only counting event is a card settled by a hand gesture —
  a `pagingEnabled` momentum end that was not caused by a programmatic jump.
  The settled card speaks (if auto pronunciation is on) and advances the
  pointer. Nothing else records anything.
- **Continuity**: learning advances only by swiping. The progress bar is a
  free locator — the thumb follows the finger anywhere — but releasing ahead
  of the learned frontier snaps back to the last learned card, so words can
  never be counted after a jump. Review never moves the pointer and never
  records. The bar defaults to hidden.
- **Rounds**: walking off the last card shows a round-complete page; the next
  swipe starts the following round (idempotent, pointer resets to 0).
- Header is fixed: progress bar row, then back/search row; the card area is
  measured below it so spacing never shifts.

## Search & word page

- Search: contains-match over the active bucket; rows show position and a red
  dot when flagged.
- A result opens the **word page**: a full bucket browser. Swipe up/down to
  move through words, scrub the progress bar (default on) to any position,
  replay, reveal, and flag all work.
- None of it counts as studying: no pointer movement, no word counts, no feed
  time. The active bucket always follows the settings store.

## Stats

- Today row: words, studying time, in-app time.
- Heatmap: calendar year (switchable), Words/Minutes toggle, five color levels.
- Rounds: one pixel-column timeline per round — red = flagged during that
  round, green = hand-settled, gray = skipped or not reached.

## Settings

- Feed: auto pronunciation, speech rate (dropdown), progress bar in feed
  (default off), progress bar dragging, progress bar in word page (default
  on), search entry in feed.
- Appearance: theme (system / light / dark).
- General: today time readout.
- About: version, sound hint (replays the iOS silent-switch notice).
