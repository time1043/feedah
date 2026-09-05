# Plan

The agreed roadmap. Flip `[ ]` to `[x]` in the same change that lands the item
on the integration branch.

## Phase 1 — MVP (started 260830)

- [x] Project skeleton: four tabs, fullscreen feed route, theme tokens with
      light / dark / system
- [x] SQLite schema, migrations, and bucket seeding from `data/*.json`
- [x] Feed: swipe up/down, settle-based counting, TTS, position number,
      tap-to-reveal meaning, bookmark flag, round-complete page
- [x] Progress bar in feed: draggable, browse mode on drag, resume control
- [x] Home: bucket chips, round + pointer readout, start button, search entry
- [x] Word list: bucket tabs, three columns, jump bar, flag dots, rows open the
      word browser
- [x] Search + word browser page: swipe to switch, progress bar, zero recording
- [x] Stats: selected-day numbers, yearly heatmap (month/weekday labels,
      words/minutes toggle, tappable cells), per-bucket round tabs, green/red
      counts, Skia timelines
- [x] Settings: grouped feed / appearance / general / about; theme, speech
      rate dropdown, progress bar toggles, live time readout
- [x] Time tracking: app time + feed time, daily aggregation
- [x] App icon set (icon, adaptive, monochrome, splash, favicon) and store
      identity (`com.time1043.feedah`)
- [x] Developer docs: architecture, data model, feature spec, development,
      plan

## Agreed, not started

- [x] Flagged-words review pass: study only the words marked unfamiliar in the
      current bucket (first item after the MVP; the data model already
      supports it)
- [x] Round review: tap a red count (home / stats) to review the words flagged
      during that specific round
- [x] Day review: from stats, tap the words number of a selected day to review
      every word completed that day across buckets (`round_word.reached_at`)
- [ ] Quiz mode: English word with four Chinese options, plus example
      sentences to support guessing (planned after the review passes)
- [ ] User-created buckets: let users import their own word lists (later)

## Open questions

- [x] `data/370.json` contains 369 words — confirm whether a row is missing or
      the bucket should be renamed

## Decided against

- Left/right swipe semantics on feed cards (gesture conflicts; the bookmark
  already covers the need)
- A–Z sorting in the word list (bucket order is a memory anchor)
- Deep list ↔ feed integration (partially covered by the word browser)
