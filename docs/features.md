# Feature spec

The product contract behind the screens. Any code change that alters these
rules is a product change, not a refactor.

## Home

- Bucket chips (three fixed buckets, fully isolated progress), current round,
  big `pointer / word_count` readout with green/red counts for the current
  round, Start/Continue button, search entry.
- Review entry: `Review · N` (N = currently flagged words in the bucket),
  disabled while N is 0.

## Review pass

Three review flavors share one screen:

- **Live set** (default, `Review · N` on home): the bucket's currently flagged
  words — the set that round inheritance carries forward.
- **Round review** (red count entries): the words flagged during one specific
  round (a historical snapshot). Entered by tapping a red count — the current
  round's on home, or any round's in the stats list.
- **Day review** (stats, tap the words number): the distinct words completed
  on the selected local day, across all buckets. Great as a daily wrap-up.

All behave identically:

- Same card and gestures as the feed: swipe up/down, tap the word to replay,
  tap elsewhere to reveal, bookmark to flag/unflag.
- Header progress bar and the `Review` label track the **queue** position
  (`x/N`), not the bucket position; the card keeps showing the bucket position
  as its anchor number. The title's bucket suffix is the bucket of the word
  currently on screen — a day review can span several buckets, and the label
  switches as the queue crosses into the next bucket.
- The queue is snapshotted on entry. Unflagging during the session updates the
  word and the current round immediately, but the queue keeps the word until
  the next pass, and historical rounds are never rewritten.
- The end card lingers for two seconds, then leaves the session.
- Nothing is recorded: no pointer movement, no rounds, no word counts. The
  time spent counts as studying.

## Feed (the core)

- Fullscreen, no tab bar. One card per page, swipe up / down.
- Card layout: position number (large), the word, its ipa, and a fixed-height
  slot for the meaning in the top half; word forms in a fixed 2×6 grid (12
  cells, caption-sized so the dataset's longest 22-char form fits without
  truncation, with margin before the bookmark) in the bottom half; the
  bookmark at the bottom. Slots and the forms grid are fixed, so toggling or
  switching words never shifts the layout or card height.
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
- **Rounds**: walking off the last card shows a round-complete page; it
  lingers for two seconds and then opens the new round automatically.
- Header is fixed: progress bar row, then back/browse/search row; the card
  area is measured below it so spacing never shifts.

## Word list

- Bucket tabs for **all** buckets (browsing only — switching tabs here does
  not change the bucket being studied; the tab defaults to the active bucket).
- Bucket order, three columns (position, word, meaning), red dots on flagged
  words, jump bar for quick positioning.
- Tapping a row opens the word page pinned to that row's bucket and position.

## Search & word page

- **Scope**: home search spans **every bucket** and matches English words and
  Chinese meanings — each bucket is searched separately and results are never
  deduped, on purpose: a word living in two buckets is worth seeing, and a
  duplicate inside one bucket surfaces a data problem instead of hiding it.
  Feed search is pinned to that feed's bucket and matches words only.
- **Wildcards**: both search bars accept `*` (any run of characters) and `_`
  (exactly one character), matching the whole word — `m*p` finds map / mop.
  Without wildcards the query is a contains-match.
- Every result row shows which bucket it came from; tapping a result opens the
  word page pinned to that bucket and position.
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
  toggle, five color levels, tappable cells. Under the grid, one subordinate
  summary line for the displayed year: its cumulative words, studying time,
  and in-app time (follows the year switcher; the selected day readout stays
  the visually dominant one).
- Rounds: one tab per bucket that has been started (defaults to the active
  bucket; never-started buckets do not appear). Each round shows its position
  progress, the completion date for finished rounds, green/red word counts,
  and a pixel-column timeline — red = flagged, green = hand-settled, gray =
  skipped or not reached.

## Settings

- Feed: auto pronunciation, speech rate (dropdown), meaning display (tap to
  show / tap to hide / always shown), progress bar in feed (default off),
  progress bar dragging, progress bar in word page (default on), search entry
  in feed.
- Appearance: theme (system / light / dark).
- General: today time readout.
- About: version, sound hint (replays the iOS silent-switch notice), clear all
  data (danger-styled, double-confirmed; wipes progress, flags, stats and
  settings, then re-seeds the buckets — currently a dev/debug utility).

## Reminders

- Settings → Reminders: a master switch plus a **dynamic reminder list**. The
  defaults are three daily times (8:30 / 12:30 / 18:30 — right after a meal
  works best); every reminder can be renamed (tap its label; the rename sheet
  also deletes it), re-timed via the native time picker (tap its time), and
  switched off individually. `Add reminder` appends as many as needed; the
  master switch disables the whole feature.
- Turning the feature on asks for notification permission once; without it the
  switch stays off with a hint. If the user already denied the permission (the
  system dialog never re-shows), the alert gains an `Open settings` button that
  jumps straight to feedah's notification page.
- Delivered as a light notification: heads-up banner plus a lockscreen
  entry (HIGH-importance channel) — not a ringing alarm.
- Expo Go on Android cannot run these reminders (its notification APIs were
  removed in SDK 53) — the app detects this, keeps the switch off, and asks
  for a development build or standalone APK. iOS Expo Go works.
- Android timing: the manifest declares `USE_EXACT_ALARM` (auto-granted on
  Android 13+) plus `SCHEDULE_EXACT_ALARM` (covers Android 12, where it is
  granted by default), so exact alarms need no user setup and reminders fire
  on time even with the screen off. Aggressive OEM ROMs may still need
  autostart / battery-optimization exemptions.
- Local daily notifications are scheduled through expo-notifications (one
  request per enabled reminder, rescheduled on every change and on app launch).
- Nothing about reminders touches study statistics.
