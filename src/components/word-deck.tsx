import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FlatList, View } from 'react-native'

import type { Word } from '@/types/bucket'

import { ProgressBar } from '@/components/progress-bar'
import { WordCard } from '@/components/word-card'

type WordDeckProps = {
  words: Word[]
  /** The deck decides WHEN to speak — the card it opens on, every card it
   * lands on, and replay taps; the screen decides HOW and WHETHER (its
   * callback carries the rate and the settings). */
  onSpeak?: (word: Word) => void
  /** Whether the deck's own speak calls (open + settle) may proceed; replay
   * taps bypass this and always reach onSpeak. The screen holds it closed
   * until its settings have hydrated and its policy allows speaking; when
   * the flag flips open, the deck speaks the card it is currently on. While
   * it is closed, speak calls are dropped WITHOUT being marked as spoken. */
  canSpeak?: boolean
  /** Whether the meaning waits for a tap; forwarded to every card. */
  tapToReveal?: boolean
  /** Card to open on, clamped into range; read once on mount. */
  initialIndex?: number
  /** Whether the scrubbable progress bar renders above the cards. */
  progressBar?: boolean
  /** The current card changed (opened, swiped, scrubbed): mirror it out. */
  onIndexChange?: (index: number) => void
  /** Quiet footer slots on the bottom line (page counter, round/time). */
  hudLeft?: ReactNode
  hudRight?: ReactNode
}

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
  initialIndex = 0,
  progressBar = true,
  onIndexChange,
  hudLeft,
  hudRight,
}: WordDeckProps) {
  // Measured height of the scroll viewport; the list mounts once it is known.
  const [viewport, setViewport] = useState(0)
  // The card to open on, clamped once: FlatList only reads its
  // initialScrollIndex at mount, and the deck mounts once per session.
  const initial = Math.max(0, Math.min(initialIndex, words.length - 1))
  const listRef = useRef<FlatList<Word> | null>(null)
  // The card currently on screen, for the re-snap and the open speak below.
  const indexRef = useRef(initial)
  // One speak per index: an animated advance settles its target twice
  // (explicitly + via the animation's momentum end) — only the first speaks,
  // otherwise the word audibly restarts.
  const spokenIndexRef = useRef(-1)

  const speakAt = (target: number) => {
    if (!onSpeak || canSpeak === false) return
    if (spokenIndexRef.current === target) return
    const word = words[target]
    if (!word) return
    spokenIndexRef.current = target
    onSpeak(word)
  }

  // The card currently on screen: state mirrors it to the progress bar; the
  // ref feeds the re-snap without re-rendering.
  const [index, setIndex] = useState(initial)

  const scrubTo = (target: number) => {
    const clamped = Math.max(0, Math.min(target, words.length - 1))
    // Programmatic jumps (animated: false) fire no events — the jump and the
    // mirror happen here, and speakAt marks the card as spoken.
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
    indexRef.current = clamped
    setIndex(clamped)
    speakAt(clamped)
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

  return (
    <View className="flex-1">
      <View className="px-4 pb-1">
        {progressBar && (
          <ProgressBar value={index} max={words.length} scrubbable onScrub={scrubTo} />
        )}
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
            data={words}
            keyExtractor={(word) => `w-${word.position}`}
            renderItem={({ item }) => (
              <View style={{ height: viewport }}>
                <WordCard word={item} tapToReveal={tapToReveal} onReplay={() => onSpeak?.(item)} />
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
              const landed = Math.round(event.nativeEvent.contentOffset.y / viewport)
              indexRef.current = landed
              setIndex(landed)
              speakAt(landed)
            }}
          />
        )}
      </View>

      {hudLeft && <View className="bottom-8 left-6 absolute">{hudLeft}</View>}
      {hudRight && <View className="bottom-8 right-6 absolute">{hudRight}</View>}
    </View>
  )
}
