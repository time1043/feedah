# Drill plugins

A drill is **how a card is answered**. It is not a screen, not a progress
mechanism and not a stats category: every drill shares the probe, the round
flags and the round-advance protocol, and the mode it runs in (study /
review / date-walks) decides what answering means for the session.

The three built-ins live here as self-contained modules:

| file        | id      | profile                                              |
| ----------- | ------- | ---------------------------------------------------- |
| `swipe.tsx` | `swipe` | free scroll, no answers; the registry's fallback     |
| `quiz.tsx`  | `quiz`  | answer-gated, auto-advance 650ms, auto-flag on wrong |
| `type.tsx`  | `type`  | answer-gated, auto-advance 900ms, auto-flag on wrong |

## The contract

`contract.ts` is the entire plugin surface. The core app (screens, session,
settings) imports only the contract and the registry — it never imports a
drill module. The `Drill` interface is:

- **`id`** — any unique string. Persisted into AsyncStorage
  (`feedah.study-mode`), so it must be stable across releases.
- **`label`** — the settings chip and deck title (`Study(Quiz) 2050`).
- **`prepare?(words)`** — runs once per data load: initial focus, round
  advance, review round-walk, day/flag walks. All randomness lives here;
  whatever it builds must stay fixed for the whole session.
- **`renderCard(props)`** — the card. `DrillCardProps` carries the word,
  the current `AnswerState`, the lifted `draft`/`onDraft`, the callbacks
  (`onAnswer(correct, picked?)`, `onSkip`, `onReplay`, `onToggleFlag`) and
  the deck's `tapToReveal` setting (the swipe card's preference; answer-
  driven cards ignore it).
- **Capability flags** — `speakOnSettle` (the deck auto-speaks the current
  card; for typing that IS the dictation cue — speech never leaks the
  spelling), `scrubbable`, `scrollable` (answer-gated drills are `false`),
  `autoAdvanceMs?` (advances after a CORRECT answer only; wrong answers
  stay so the reveal can be read), `autoFlagOnWrong?`.
- **`endCopy(facts)`** — end-page copy: `title`, optional `stats`, `note`.

## Writing one

1. Create `src/drills/my-drill.tsx` exporting a `Drill` as the module
   default. Reuse the card widget kit (`@/components/drill/card-parts` —
   `CardHeadword`, `CardMeaning`, `CardForms`, `BookmarkButton`) so cards
   keep the feed layout; bespoke card components may live beside the
   plugin or in `@/components/drill/`.
2. Add one line to `MANIFEST` in `registry.ts`. Done — the settings chips,
   the home label, routing (`/mode/study/my-drill`) and session wiring pick
   it up with no other core change.

## The two recycling rules

Cards are FlatList-recycled (`windowSize: 3`), so a card holds **no
session state**:

1. Per-card input state (e.g. typing's draft) is lifted to the screen via
   `draft`/`onDraft`.
2. Per-card private data (e.g. quiz's shuffled options) lives in a
   module-level Map owned by the plugin module, keyed by
   `` `${bucketName ?? ''}:${position}` `` — the bucket prefix matters:
   date-walk decks span buckets, where positions collide. `prepare()`
   rebuilds it per load; `renderCard` only reads it.

## Testing

The registry is covered by `tests/drills/registry.test.ts` (manifest
order, id lookup, swipe fallback, duplicate refusal). A drill's grading
helpers belong in `src/lib/` with tests in `tests/lib/` (see
`quiz.ts` / `tests/lib/quiz.test.ts`); the session layer is tested
behaviorally in `tests/lib/use-study-session.test.tsx` against a hand-built
`Drill` fixture that shows the minimal gated profile.
