# v0.0.1

First MVP release.

## Word feed

- Fullscreen one-card-per-page feed over three bundled buckets
  (2050 / 700 / 370), swipe up / down, tap the word to replay its
  pronunciation, tap elsewhere to reveal the meaning and word forms.
- Bookmark (flag) unfamiliar words right from the card.
- Studying mode records progress automatically; scrubbing the progress bar
  switches to browsing — free navigation with nothing recorded — and a
  `Resume studying` control jumps back to the first unlearned card.
- Completing a round opens the next one automatically.

## Review

Three review flavors share the feed experience (same gestures, bookmarking,
and end card):

- **Live set** — the bucket's currently flagged words, carried forward by
  round inheritance.
- **Round review** — the words flagged during one specific round, from the
  home red count or any round in the stats list.
- **Day review** — every word completed on the selected day, across buckets;
  a daily wrap-up.

Reviews record nothing: no pointer movement, no word counts — but the time
spent counts as studying.

## Search

- Home search spans **every bucket** and matches both English words and
  Chinese meanings; feed search is pinned to the current bucket.
- Wildcards: `*` (any run of characters) and `_` (exactly one character),
  whole-word matching — `m*p` finds map and mop. Without wildcards it is a
  contains-match.
- Every result shows its bucket; tapping opens a full bucket browser (word
  page) with swipe, scrubbing, replay, reveal, and flagging.

## Word list

Bucket tabs, position / word / meaning columns, red dots on flagged words,
and a jump bar for quick positioning.

## Stats

- Calendar-year heatmap with a Words / Minutes toggle and five color
  levels; tap a day for its words, studying time, and in-app time.
- Yearly cumulative summary under the grid.
- Per-round timelines: red = flagged, green = hand-settled, gray = skipped;
  finished rounds show their completion date.

## Reminders

- Dynamic reminder list: rename, retime via the native picker, add as many
  as you want, switch each off individually.
- Exact alarms on Android 12–14 (no extra setup), delivered as heads-up
  notifications, playful message pool included.

## Cloud sync (optional)

- Sign up or sign in with an email + password to keep progress across
  devices; settings, flags, round history, and stats all follow.
- Guests are fully local — no account, no cloud rows, and the app works
  offline forever.
- "Clear all data" wipes the device and the cloud copy together (it needs a
  connection so the two cannot drift apart).

## Housekeeping

- System / light / dark theme; version shown in Settings → About.
