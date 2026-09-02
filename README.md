# feedah

Vocabulary building as a short-video feed. Words are swiped one card at a
time; mastery comes from repeated exposure across rounds, not from memorizing
a word on first sight.

Built with Expo SDK 57, React Native, expo-router, expo-sqlite, expo-speech,
and @shopify/react-native-skia. React Compiler is enabled; no manual memo
hooks are used. Local-only data (SQLite), no accounts.

## Get started

```bash
pnpm install
npx expo start
```

Run on a real device for pronunciation: `npx expo start` then open in
Expo Go. On iPhone, pronunciation is muted while the ring/silent switch is on.

## Documentation

- [Architecture](docs/architecture.md) — stack, structure, layers, gotchas
- [Data model](docs/data-model.md) — tables and counting semantics
- [Feature spec](docs/features.md) — the interaction contract per screen
- [Development](docs/development.md) — setup, buckets, builds, conventions

## Word buckets

Buckets live in `data/` as markdown tables (columns: `# | word | ipa |
meaning | forms`) and are **not tracked by git**. They are converted to JSON
and bundled into the app:

```bash
node scripts/convert-bucket.mjs   # data/*.md -> data/*.json
```

The JSON is seeded into SQLite on first launch (re-seeded automatically if a
bucket file changes). Buckets are isolated: each keeps its own round, pointer,
and flags.

## How progress works

- The only counting event is a card settled by a hand gesture; forward
  progress is strictly swipe-by-swipe. The feed progress bar only drags
  backward through already-learned words for review.
- The pointer is a high-water mark: going back to review never moves it.
- Daily word count = difference of daily pointer snapshots; nothing is
  counted twice.
- Two time metrics are tracked per day: total app time and feed time.
- The bookmark flags a word as unfamiliar; flags are recorded per round and
  drive the red/green round timelines in Stats.

## Branches

- `main` — upstream baseline.
- `mvp/260830` — MVP integration branch.
- `mvp/feat/<module>/260830` — one branch per module, merged back with
  `--no-ff` and deleted after merge.
