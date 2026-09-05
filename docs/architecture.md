# Architecture

## Stack

- Expo SDK 57, React Native 0.86, TypeScript (strict)
- expo-router with typed routes; React Compiler enabled
- expo-sqlite (WAL) for all persistence, expo-speech for pronunciation,
  expo-notifications for daily meal reminders
- @shopify/react-native-skia for round timelines
- Optional cloud sync via Convex + Convex Auth (anonymous + email/password);
  local-only when no deployment URL is configured
- Styling: plain StyleSheet with theme tokens (no UI framework)

## Structure

```
src/
  app/              expo-router routes
    _layout.tsx       providers + root stack (tabs group, fullscreen feed)
    (tabs)/           home, words, stats, settings
    feed.tsx          fullscreen swipe feed
    search.tsx        word search
    word/[position]   single card page (opened from search)
  components/       reusable UI: word-card, progress-bar, heatmap, round-bar, screen
  db/               sqlite: schema, seed, repo, settings store, usage tracker
  cloud/            convex client, sync engine, cloud→sqlite mirror
  lib/              pure helpers: date, format, daily aggregation, speech, color
  theme/            palette, tokens, provider
convex/             convex deployment: auth, schema, sync push/pull (cloud_* tables)
scripts/            generate-assets.mjs
data/               local word buckets (gitignored, bundled at build)
```

## Layers

- `app/` routes own container logic: paging, settle detection, data loading.
- `components/` are presentational. `WordCard` is the one shared piece between
  the feed and the single-word page; it knows nothing about paging or stats.
- `db/repo.ts` is the only place that talks SQL; screens never query directly.
- `db/settings.tsx` is the preference store (React context over the `meta` table).
- `cloud/` never blocks the UI: sync runs in the background and the app reads
  SQLite only. See docs/cloud-sync.md for the merge rules.
- `lib/` contains pure functions only — no React, no I/O.

## Principles

- Simple by contract: one feed, one active round, no scheduling algorithms.
  Repetition across rounds is the mechanism — there is no spaced repetition.
- Every write derives from one explicit event (a settled card, a flag toggle,
  a time flush). Nothing is inferred or back-filled.
- Buckets are isolated: each keeps its own round, pointer, and flags.

## Gotchas learned the hard way

- React Compiler is on: never add `useMemo`/`useCallback`/`React.memo`, and
  never read module-level mutable state during render — the compiler treats it
  as pure and memoizes it, freezing the UI. Sample external state into
  `useState` instead (see the live clock in settings).
- The settings store is the single source of truth for the active bucket.
  Switching buckets on home must go through `update({ activeBucketId })`;
  writing the `meta` table directly leaves feed, search, and the word page on
  a stale bucket until restart.
- The root layout must wrap everything in `SafeAreaProvider`. Expo Go injects
  one for you; a standalone APK does not, and insets silently resolve to zero.
- Feed card height must be the *measured* viewport height (`onLayout`), not
  the window height. `pagingEnabled` snaps to multiples of the container
  height; any mismatch drifts across pages and shows two cards at once.
- On iOS, `expo-speech` is muted while the ring/silent switch is on; the feed
  shows a one-time hint for this.
- Skia's `Canvas` does not support `onLayout` on the new architecture
  (Fabric — the default in Expo Go). Measure a wrapping `View` and pass the
  size to `Canvas` as an explicit style instead.
- `expo-notifications` must be lazy-required and guarded: in Expo Go on
  Android the module throws when imported (remote-notification APIs were
  removed there). Reminders degrade to a no-op when the module is
  unavailable; they need a development build or standalone APK on Android.
- Consult the docs for the exact SDK version before adding APIs:
  https://docs.expo.dev/versions/v57.0.0/
