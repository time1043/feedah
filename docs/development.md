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

## Conventions

- **Branches**: `main` is the baseline, `mvp/260830` is the integration
  branch, `mvp/feat/<module>/260830` is one branch per module. Merge with
  `--no-ff`, keep the branch after merging, push all branches.
- **Commits**: small complete units that each build and run, with conventional
  prefixes (`feat:`, `fix:`, `chore:`, `docs:`).
- **Language**: code, comments, docs, and UI text in English, concise.
- **React Compiler is enabled** — no manual memo hooks; keep renders free of
  external mutable state (see architecture gotchas).
- Read the Expo docs for the exact SDK version before adding APIs:
  https://docs.expo.dev/versions/v57.0.0/
