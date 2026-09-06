# feedah

Vocabulary building as a short-video feed. Words are swiped one card at a
time; mastery comes from repeated exposure across rounds, not from memorizing
a word on first sight.

Built with Expo SDK 57, React Native, expo-router, expo-sqlite, expo-speech,
and @shopify/react-native-skia. React Compiler is enabled; no manual memo
hooks are used. Data lives in local SQLite; optional cloud alignment via
Convex (accounts never required — see [Cloud sync](docs/cloud-sync.md)).

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
- [Development](docs/development.md) — setup, buckets, builds, working agreement
- [Plan](docs/plan.md) — roadmap: done, agreed-not-started, decided against

## Word buckets

Buckets live in `data/` as local JSON (`{ name, words: [{ position, word, ipa,
meaning, forms }] }`), gitignored and never committed. The JSON is bundled at build
time and seeded into SQLite on first launch; a later APK whose bundled word count
changed is re-seeded automatically (flags reset). To add a bucket, drop
`data/<name>.json` and register it in `src/db/seed.ts` (import + add to
`BUNDLED_BUCKETS`). Buckets are isolated: each keeps its own round, pointer, flags.

Reference word banks: https://github.com/time1043/vocabulary-bucket (same schema;
its JSON bucket files map 1:1 to this project's buckets).

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
- `mvp/260830` — MVP integration branch (a later phase starts `mvp/260930`).
- `mvp/feat/<module>/<date>` and `mvp/fix/<topic>/<date>` — one branch per
  unit of work, merged back with `--no-ff` and kept.
