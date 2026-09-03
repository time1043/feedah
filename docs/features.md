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
- **Counting**: studying counts a card when you swipe **past** it — landing on
  a card completes the previous one, so the card on screen is still in
  progress and exiting there loses nothing. The newly shown card speaks (if
  auto pronunciation is on) and the completed card advances the pointer.
  Nothing else records anything.
- **Modes**: the feed has a *studying* mode (default) and a *browsing* mode.
  Scrubbing the progress bar switches to browsing — free navigation in both
  directions, nothing recorded. A `Resume studying` control in the header
  returns to the first unlearned card and re-enables recording. The bar
  defaults to hidden.
- **Rounds**: walking off the last card shows a round-complete page; the next
  swipe starts the following round (idempotent, pointer resets to 0).
- Header is fixed: progress bar row, then back/browse/search row; the card
  area is measured below it so spacing never shifts.

## Word list

- Bucket tabs for **all** buckets (browsing only — switching tabs here does
  not change the bucket being studied; the tab defaults to the active bucket).
- Bucket order, four columns (position, word, meaning, forms), red dots on
  flagged words, jump bar for quick positioning.
- Tapping a row opens the word page pinned to that row's bucket and position.

## Search & word page

- Search: contains-match over the active bucket; rows show position and a red
  dot when flagged.
- A result opens the **word page**: a full bucket browser. Swipe up/down to
  move through words, scrub the progress bar (default on) to any position,
  replay, reveal, and flag all work.
- The word page browses the bucket it was opened from: search omits the bucket
  (uses the active one), the word list pins its tab's bucket explicitly.
- None of it counts as studying: no pointer movement, no word counts, no feed
  time.

## Stats

- Selected day row: words, studying time, in-app time for the day tapped on
  the heatmap (defaults to today; the title shows its date).
- Heatmap: calendar year (switchable), month and weekday labels, Words/Minutes
  toggle, five color levels, tappable cells.
- Rounds: one tab per bucket that has been started (defaults to the active
  bucket; never-started buckets do not appear). Each round shows its position
  progress, green/red word counts, and a pixel-column timeline — red =
  flagged, green = hand-settled, gray = skipped or not reached.

## Settings

- Feed: auto pronunciation, speech rate (dropdown), progress bar in feed
  (default off), progress bar dragging, progress bar in word page (default
  on), search entry in feed.
- Appearance: theme (system / light / dark).
- General: today time readout.
- About: version, sound hint (replays the iOS silent-switch notice).
