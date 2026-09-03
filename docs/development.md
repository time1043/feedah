# Development

## Setup

```bash
pnpm install
npx expo start        # open in Expo Go on a real device
```

Pronunciation requires a real device. On iPhone, sound is muted while the
ring/silent switch is on — the app shows a one-time hint.

## Word buckets

Buckets live in `data/*.md` (gitignored) as markdown tables with columns
`# | word | ipa | meaning | forms`:

```bash
node scripts/convert-bucket.mjs     # data/*.md -> data/*.json
```

The JSON is bundled through imports and seeded into SQLite on first launch; a
bucket whose word count changed is re-seeded automatically (flags reset).
Restart the dev server after changing buckets so Metro picks up the JSON.
Note: a fresh clone needs the bucket files locally or bundling fails.

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
  - `mvp/base` — the standing integration branch; always shippable.
  - `mvp/feat/<module>/<date>` — one branch per module. `<date>` is the start
    day of the development phase (一期 / 二期 / 三期 …), e.g. `260830`; a new
    phase simply starts a new date suffix.
  - `mvp/fix/<topic>/<date>` — same shape, for bug fixes.
  - Merge with `--no-ff`, keep the branch after merging, push all branches.
- **Parallel AI sessions**: when several sessions work at once, give each its
  own checkout with `git worktree add <path> <branch>`; never share one
  working tree between concurrent sessions.
- **Commits**: commit after every complete unit of work. Write clear messages;
  stage only the files that belong to your change (check `git status` first) —
  never sweep in unrelated work. Every commit must type-check and run.
- **Language**: code, comments, docs, and UI text in English, concise.
- **Push** after every merged unit as soon as the network allows.
- **Data**: `data/` is user-provided and never committed.
- **Docs**: keep `docs/plan.md` marks current; record new product rules in
  `docs/features.md` in the same change that implements them.
- Read the Expo docs for the exact SDK version before adding APIs:
  https://docs.expo.dev/versions/v57.0.0/
