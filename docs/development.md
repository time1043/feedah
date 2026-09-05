# Development

## Setup

```bash
pnpm install
npx expo start        # open in Expo Go on a real device
```

Pronunciation requires a real device. On iPhone, sound is muted while the
ring/silent switch is on — the app shows a one-time hint.

## Database

The schema is declared with drizzle-orm in `src/db/schema.ts`. After editing
it, generate migrations and commit the `drizzle/` folder together with the
schema change (`metro.config.js` + `babel.config.js` inline the `.sql`
migration files into the bundle):

```bash
pnpm db:generate
```

Migrations apply automatically on first app open. Databases created before
drizzle are wiped once on open (no legacy data migration; the planned cloud
account layer supersedes local-only history).

To browse the on-device database: run a debug dev build (`pnpm start` plus
`npx expo run:android`), press `shift + m` in the Expo CLI terminal, and pick
`expo-drizzle-studio-plugin` — Drizzle Studio opens in the browser (device or
emulator only; web is not supported).

## Word buckets

Buckets live in `data/*.json` (gitignored, never committed) with the shape
`{ name, words: [{ position, word, ipa, meaning, forms }] }`. The JSON is bundled
through static imports in `src/db/seed.ts` at build time and seeded into SQLite on
first launch; a later APK whose bundled word count differs is re-seeded
automatically (flags reset). To add a bucket, drop `data/<name>.json` and register
it in `src/db/seed.ts` (import + add to `BUNDLED_BUCKETS`). Restart the dev server
after changing buckets so Metro picks up the JSON. A fresh clone needs the bucket
JSON locally or bundling fails.

Reference word banks: https://github.com/time1043/vocabulary-bucket (same schema;
its JSON bucket files map 1:1 to this project's buckets).

## Local builds

```bash
npx expo run:android --variant release   # build & install a release APK
npx expo run:ios                          # requires macOS + Xcode
```

App identity lives in `app.json` (`com.time1043.feedah`). Icons, adaptive
icons, splash, and favicon are generated from the SVG sources in the script:

```bash
node scripts/generate-assets.mjs     # requires: pnpm add -D sharp
```

If a native build complains after dependency changes, start from a clean
prebuild: `npx expo prebuild --clean`.

## Working agreement

- **Branches**
  - `main` — the upstream baseline.
  - `mvp/<date>` — the integration branch of a development phase; `<date>` is
    the phase start (一期 = `260830`). A later phase starts a new integration
    branch (`mvp/260930`) from the previous one.
  - `mvp/feat/<module>/<date>` — one branch per module within a phase.
  - `mvp/fix/<topic>/<date>` — same shape, for bug fixes.
  - `<date>` is the phase start (一期 = `260830`), not the day of work.
  - Merging is the user's call: agents must ask for and receive explicit
    approval before merging. When merged, use `--no-ff` and keep the branch.
- **Parallel AI sessions**: when several sessions work at once, give each its
  own checkout with `git worktree add <path> <branch>`; never share one
  working tree between concurrent sessions.
- **Terminal**: on Windows use Git Bash only — PowerShell and cmd are not
  allowed. Network operations (push / fetch) go through the `ex` alias, which
  exports a local proxy (`127.0.0.1:7890`); in non-interactive shells export
  `https_proxy` / `http_proxy` directly instead. macOS (zsh) setups typically
  do not need this.
- **Commits**: commit after every complete unit of work, and keep every commit
  as small as it can be while still building and running. Write clear
  messages; stage only the files that belong to your change (check
  `git status` first) — never sweep in unrelated work. Self-review the diff
  before committing: re-read it end to end and hunt for edge cases, stale
  closures, and unhandled errors.
- **Language**: code, comments, docs, and UI text in English, concise.
- **Push** is handled by the user; agents never push.
- **Data**: `data/` is user-provided and never committed.
- **Docs**: keep `docs/plan.md` marks current; record new product rules in
  `docs/features.md` in the same change that implements them.
- Read the Expo docs for the exact SDK version before adding APIs:
  https://docs.expo.dev/versions/v57.0.0/
