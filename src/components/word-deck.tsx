import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { FlatList, View } from 'react-native'

import type { DeckWord } from '@/types/bucket'

import { ProgressBar } from '@/components/progress-bar'
import { WordCard } from '@/components/word-card'

/** How long the end page lingers before performing its action. */
const END_LINGER_MS = 2000

export interface WordDeckHandle {
  /** Programmatic jump to a card, as if scrubbed: no settle events fire. */
  scrollTo(index: number): void
}

export interface WordDeckEnd {
  /** The extra page rendered after the last word. */
  render: () => ReactNode
  /**
   * Fired once when the user swipes onto the end page. Return false to veto
   * the landing (the deck snaps back to the last word and the swipe can be
   * tried again); anything else lingers END_LINGER_MS, then performs action.
   */
  onReached?: () => boolean | void
  /** What happens after the linger: 'reset' scrolls back to the first card,
   * 'close' calls onClose. */
  action: 'reset' | 'close'
}

type WordDeckProps = {
  /** The deck's words carry their live flag state: the card's bookmark is
   * the deck's only write. */
  words: DeckWord[]
  /** The deck decides WHEN to speak — the card it opens on, every card it
   * lands on, and replay taps; the screen decides HOW and WHETHER (its
   * callback carries the rate and the settings). */
  onSpeak?: (word: DeckWord) => void
  /** Whether the deck's own speak calls (open + settle) may proceed; replay
   * taps bypass this and always reach onSpeak. The screen holds it closed
   * until its settings have hydrated and its policy allows speaking; when
   * the flag flips open, the deck speaks the card it is currently on. While
   * it is closed, speak calls are dropped WITHOUT being marked as spoken. */
  canSpeak?: boolean
  /** Whether the meaning waits for a tap; forwarded to every card. */
  tapToReveal?: boolean
  /** The words' flag state forwarded to every card: the bookmark shows when
   * the screen passes a toggle, and the deck hides it otherwise (browse). */
  onToggleFlag?: (word: DeckWord) => void
  /** Card to open on, clamped into range; read once on mount. */
  initialIndex?: number
  /** Whether the scrubbable progress bar renders above the cards. */
  progressBar?: boolean
  /** The current card changed (opened, swiped, scrubbed): mirror it out. */
  onIndexChange?: (index: number) => void
  /** The user swiped onto a word card (a real gesture's landing; scrubs and
   * programmatic jumps don't count). */
  onSettle?: (index: number) => void
  /** The user released the progress bar on a card. */
  onScrub?: (index: number) => void
  /** Quiet footer slots on the bottom line (page counter, round/time). */
  hudLeft?: ReactNode
  hudRight?: ReactNode
  /** A floating banner over the cards' top edge (the browse-mode Resume
   * pill). Rendered whenever provided — independent of the header and bar
   * settings, so the affordance survives every visibility combination. */
  banner?: ReactNode
  /** The end page: rendered after the last word when present. */
  end?: WordDeckEnd
  /** What the end page's 'close' action calls; only needed with it. */
  onClose?: () => void
}

type DeckItem = { kind: 'word'; word: DeckWord } | { kind: 'end' }

/**
 * The vertical card pager: one full-screen card at a time, swiped through
 * like a short-video feed. A dumb pager — it decides nothing about the
 * words; screens hand it words and callbacks for speech, progress and
 * (later) answers.
 *
 * Two mechanics matter:
 *  - Every card is exactly the measured viewport height, kept fractional:
 *    rounding lets pagingEnabled drift off the card boundaries over time.
 *  - getItemLayout gives FlatList O(1) offset math, so paging stays aligned
 *    even with hundreds of cards.
 */
export function WordDeck({
  words,
  onSpeak,
  canSpeak = true,
  tapToReveal,
  onToggleFlag,
  initialIndex = 0,
  progressBar = true,
  onIndexChange,
  onSettle,
  onScrub,
  hudLeft,
  hudRight,
  banner,
  onClose,
  end,
  ref,
}: WordDeckProps & { ref?: Ref<WordDeckHandle> }) {
  const itemCount = words.length + (end ? 1 : 0)
  const clamp = (index: number) => Math.max(0, Math.min(index, itemCount - 1))

  // Measured height of the scroll viewport; the list mounts once it is known.
  const [viewport, setViewport] = useState(0)
  // The card to open on, clamped once: FlatList only reads its
  // initialScrollIndex at mount, and the deck mounts once per session.
  const initial = Math.max(0, Math.min(initialIndex, words.length - 1))
  const listRef = useRef<FlatList<DeckItem> | null>(null)
  // The card currently on screen. State mirrors it to the progress bar; the
  // ref feeds the re-snap without re-rendering.
  const [index, setIndex] = useState(initial)
  const indexRef = useRef(initial)
  // One speak per index: an animated advance settles its target twice
  // (explicitly + via the animation's momentum end) — only the first speaks,
  // otherwise the word audibly restarts.
  const spokenIndexRef = useRef(-1)
  const endReached = useRef(false)
  const endLingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const speakAt = (target: number) => {
    if (!onSpeak || canSpeak === false) return
    if (spokenIndexRef.current === target) return
    const word = words[target]
    if (!word) return
    spokenIndexRef.current = target
    onSpeak(word)
  }

  const scrubTo = (target: number) => {
    const clamped = Math.max(0, Math.min(target, words.length - 1))
    // Programmatic jumps (animated: false) fire no events — the jump and the
    // mirror happen here, and speakAt marks the card as spoken.
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
    indexRef.current = clamped
    setIndex(clamped)
    speakAt(clamped)
    onScrub?.(clamped)
  }

  // The viewport can re-measure (safe-area insets settling, rotation) while
  // the user is on card N. pagingEnabled never re-snaps on its own, so
  // re-apply the scroll to the same card whenever the height changes.
  useEffect(() => {
    if (viewport <= 0) return
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [viewport])

  // Mirror the current card out, whenever it changes.
  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  // A lingering end page cleans up after itself.
  useEffect(
    () => () => {
      if (endLingerTimer.current) clearTimeout(endLingerTimer.current)
    },
    [],
  )

  // The landing path shared by real gestures and the imperative handle. The
  // end page is reachable only by gestures (the bar's scrub clamps to the
  // last word); a vetoed landing snaps back without recording anything.
  const settle = (rawIndex: number) => {
    const target = clamp(rawIndex)
    // While the end page lingers, gestures record nothing.
    if (endLingerTimer.current) return

    if (end && target >= words.length) {
      if (endReached.current) return
      endReached.current = true
      if (end.onReached?.() === false) {
        endReached.current = false
        // A vetoed landing must not park on the end page — snap back to the
        // last word; the user can try the swipe again once the veto's reason
        // is gone.
        const last = Math.max(0, words.length - 1)
        indexRef.current = last
        setIndex(last)
        listRef.current?.scrollToIndex({ index: last, animated: false })
        return
      }
      setIndex(target)
      endLingerTimer.current = setTimeout(() => {
        endLingerTimer.current = null
        if (end.action === 'close') {
          onClose?.()
          return
        }
        // The reset is a programmatic jump: move the index state too, or the
        // bar stays parked on the end page. Landing back on the first card
        // re-arms the end page and speaks it — the next round starts.
        endReached.current = false
        indexRef.current = 0
        setIndex(0)
        listRef.current?.scrollToIndex({ index: 0, animated: false })
        speakAt(0)
      }, END_LINGER_MS)
      return
    }

    // Landing on a word card re-arms the end page: after a reset, the next
    // walk-through must fire onReached again.
    endReached.current = false
    indexRef.current = target
    setIndex(target)
    speakAt(target)
    onSettle?.(target)
  }

  // Opening the deck speaks the card it opens on, once the viewport is
  // known. If the screen held speaking back (its gate closed), the flip
  // open re-triggers it for whatever card the deck is on by then; the dedupe
  // keeps every other re-run quiet.
  useEffect(() => {
    if (viewport > 0) speakAt(indexRef.current)
    // speakAt reads fresh state on every call; only the measure and the
    // gate matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, canSpeak])

  // Mirror the current card out, whenever it changes.
  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  useImperativeHandle(
    ref,
    () => ({
      scrollTo: (target: number) => {
        const clamped = clamp(target)
        listRef.current?.scrollToIndex({ index: clamped, animated: false })
        indexRef.current = clamped
        setIndex(clamped)
      },
    }),
    // clamp reads only props; the handle stays stable for the deck's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const items: DeckItem[] = [
    ...words.map((word) => ({ kind: 'word' as const, word })),
    ...(end ? [{ kind: 'end' as const }] : []),
  ]

  return (
    <View className="flex-1">
      <View className="px-4 pb-1">
        {progressBar && <ProgressBar value={index} max={itemCount} scrubbable onScrub={scrubTo} />}
      </View>

      <View
        className="flex-1"
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height
          if (height > 0 && Math.abs(height - viewport) > 0.01) setViewport(height)
        }}
      >
        {viewport > 0 && (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item, i) =>
              item.kind === 'word' ? `w-${item.word.position}-${i}` : 'end'
            }
            renderItem={({ item }) => (
              <View style={{ height: viewport }}>
                {item.kind === 'word' ? (
                  <WordCard
                    word={item.word}
                    tapToReveal={tapToReveal}
                    flagged={item.word.flagged}
                    onToggleFlag={onToggleFlag ? () => onToggleFlag(item.word) : undefined}
                    onReplay={() => onSpeak?.(item.word)}
                  />
                ) : (
                  end?.render()
                )}
              </View>
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            // A bucket can hold hundreds of cards: keep the rendered window small.
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(_, index) => ({ length: viewport, offset: viewport * index, index })}
            initialScrollIndex={initial}
            onMomentumScrollEnd={(event) => {
              // Programmatic jumps (animated: false) fire no events, so this is
              // a real gesture's landing — the deck has settled on the card.
              settle(Math.round(event.nativeEvent.contentOffset.y / viewport))
            }}
          />
        )}

        {/* The floating banner hugs the bar's underside — inside the card
            viewport, so it exists no matter which chrome the settings hide.
            box-none keeps taps outside the banner on the cards underneath. */}
        {banner && (
          <View className="top-1 left-0 right-0 absolute items-center" pointerEvents="box-none">
            {banner}
          </View>
        )}
      </View>

      {hudLeft && <View className="bottom-8 left-6 absolute">{hudLeft}</View>}
      {hudRight && <View className="bottom-8 right-6 absolute">{hudRight}</View>}
    </View>
  )
}
