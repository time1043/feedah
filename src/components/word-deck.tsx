import { Ionicons } from '@expo/vector-icons'
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { FlatList, Pressable, Text, View, useColorScheme } from 'react-native'

import type { DeckWord } from '@/types/word'

import { ProgressBar } from '@/components/progress-bar'
import { WordCard } from '@/components/word-card'

/** How long the end page lingers before performing its action. */
const END_LINGER_MS = 2000

/** The styling of a bottom-corner study readout: quiet, tabular numbers. */
export function DeckReadout({ children }: { children: ReactNode }) {
  return (
    <Text
      className="text-gray-400 dark:text-gray-500 text-[11px]"
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {children}
    </Text>
  )
}

export interface WordDeckHandle {
  /** Programmatic jump to a card, as if scrubbed: no settle events fire. */
  scrollTo(index: number): void
}

export interface WordDeckEnd {
  /** The extra page rendered after the last word. */
  render: () => ReactNode
  /**
   * Fired once when the user swipes onto the end page. Return false to veto
   * the landing (no linger, the deck stays put and can be swiped off again);
   * anything else lingers END_LINGER_MS, then performs action.
   */
  onReached?: () => boolean | void
  /** What happens after the linger: 'reset' scrolls back to the first card,
   * 'close' calls onClose. */
  action: 'reset' | 'close'
}

type WordDeckProps = {
  words: DeckWord[]
  /** Card to open on (clamped); read on mount and whenever resetKey changes. */
  initialIndex?: number
  /**
   * Changing it restarts the session: the list remounts and initialIndex is
   * re-applied. FlatList only honors initialScrollIndex on mount, so a new
   * dataset needs a new key.
   */
  resetKey?: string
  /** The current card changed (opened, swiped, scrubbed): speak it. */
  onSpeak?: (word: DeckWord) => void
  /** The user swiped onto a word card. */
  onSettle?: (word: DeckWord, index: number) => void
  /** The user released the progress bar on a card. */
  onScrub?: (index: number) => void
  onToggleFlag?: (word: DeckWord) => void
  /** Center of the header row (mode pill, title, …). */
  headerCenter?: ReactNode
  /** Right end of the header row (search icon, …). */
  headerRight?: ReactNode
  /** Bottom-corner readouts, on the flag bookmark's row. Optional and subtle
   * by design; consumers pass study-state text (round/time, position). */
  footerLeft?: ReactNode
  footerRight?: ReactNode
  onClose: () => void
  /** Whether the progress bar can be grabbed and scrubbed. */
  scrubbable?: boolean
  end?: WordDeckEnd
}

type DeckItem = { kind: 'word'; word: DeckWord } | { kind: 'end' }

/**
 * The shared skeleton of every swipe-through-words screen (feed, review,
 * browse): a header with a scrubbable progress bar, and a full-screen
 * vertical pager showing exactly one card at a time. Pages own the policy —
 * which words, what a settle records, whether an end page exists and what it
 * does — through the callbacks; this component owns the mechanics.
 *
 * Mechanics worth knowing:
 *   - The viewport height is measured and kept fractional; every card is
 *     exactly that tall, otherwise pagingEnabled snapping drifts off the
 *     card boundaries.
 *   - All programmatic jumps are instant (animated: false), which fires no
 *     scroll events; a `suppressSettle` flag guards against any stray event,
 *     and the next real gesture's momentum-begin clears it.
 *   - Settles are computed from contentOffset / viewport on momentum end,
 *     never from gesture velocity.
 */
export function WordDeck({
  ref,
  words,
  initialIndex = 0,
  resetKey,
  onSpeak,
  onSettle,
  onScrub,
  onToggleFlag,
  headerCenter,
  headerRight,
  footerLeft,
  footerRight,
  onClose,
  scrubbable = false,
  end,
}: WordDeckProps & { ref?: Ref<WordDeckHandle> }) {
  const scheme = useColorScheme() ?? 'light'
  const itemCount = words.length + (end ? 1 : 0)
  const clamp = (index: number) => Math.max(0, Math.min(index, itemCount - 1))

  const [index, setIndex] = useState(() => clamp(initialIndex))
  // Measured height of the scroll viewport; the list mounts once it is known.
  const [viewport, setViewport] = useState(0)

  const listRef = useRef<FlatList<DeckItem> | null>(null)
  const suppressSettle = useRef(false)
  const indexRef = useRef(index)
  const endLingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endReached = useRef(false)

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(
    () => () => {
      if (endLingerTimer.current) clearTimeout(endLingerTimer.current)
    },
    [],
  )

  // A new resetKey is a new session: re-apply the initial card. initialIndex
  // is only meaningful together with resetKey, hence not a dependency.
  useEffect(() => {
    setIndex(clamp(initialIndex))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Alignment insurance: initialScrollIndex aims with the first viewport
  // measure, which on Android can predate the final safe-area insets — the
  // list then comes to rest between two pages and pagingEnabled never
  // re-snaps on its own. Re-apply the scroll whenever the viewport
  // re-measures: the first pass lands on the initial card, a later
  // re-measure (insets settling, rotation) re-snaps to the user's card.
  useEffect(() => {
    if (viewport <= 0) return
    const frame = requestAnimationFrame(() => {
      suppressSettle.current = true
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [viewport])

  const speakAt = useEffectEvent((target: number) => {
    const word = words[target]
    if (word && onSpeak) onSpeak(word)
  })

  const settle = useEffectEvent((rawIndex: number) => {
    const target = clamp(rawIndex)
    // While the end page lingers, gestures record nothing.
    if (endLingerTimer.current) return

    if (end && target >= words.length) {
      if (endReached.current) return
      endReached.current = true
      if (end.onReached?.() === false) {
        endReached.current = false
        setIndex(target)
        return
      }
      setIndex(target)
      endLingerTimer.current = setTimeout(() => {
        endLingerTimer.current = null
        if (end.action === 'close') onClose()
        else listRef.current?.scrollToIndex({ index: 0, animated: false })
      }, END_LINGER_MS)
      return
    }

    // Landing on a word card re-arms the end page: after a reset, the next
    // walk-through must fire onReached again.
    endReached.current = false
    setIndex(target)
    speakAt(target)
    const word = words[target]
    if (word && onSettle) onSettle(word, target)
  })

  const scrubTo = useEffectEvent((target: number) => {
    const clamped = clamp(target)
    suppressSettle.current = true
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
    setIndex(clamped)
    if (onScrub) onScrub(clamped)
    speakAt(clamped)
  })

  useImperativeHandle(ref, () => ({
    scrollTo: (target: number) => {
      const clamped = clamp(target)
      suppressSettle.current = true
      listRef.current?.scrollToIndex({ index: clamped, animated: false })
      setIndex(clamped)
    },
  }))

  // Speak the card the deck opens on; a resetKey change opens a new session.
  useEffect(() => {
    speakAt(clamp(initialIndex))
  }, [resetKey])

  const items: DeckItem[] = [
    ...words.map((word) => ({ kind: 'word' as const, word })),
    ...(end ? [{ kind: 'end' as const }] : []),
  ]

  return (
    <View className="flex-1">
      <View className="px-4 pb-1">
        <View className="min-h-11 py-1 flex-row items-center">
          <Pressable
            className="w-8 items-start"
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close"
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
            />
          </Pressable>
          <View className="flex-1 items-center">{headerCenter}</View>
          <View className="w-8 items-end">{headerRight}</View>
        </View>
        <ProgressBar value={index} max={itemCount} scrubbable={scrubbable} onScrub={scrubTo} />
      </View>

      <View
        className="flex-1"
        onLayout={(event) => {
          // Keep the exact fractional height: rounding would accumulate
          // sub-pixel drift between page snapping and item heights.
          const height = event.nativeEvent.layout.height
          if (height > 0 && Math.abs(height - viewport) > 0.01) setViewport(height)
        }}
      >
        {viewport > 0 && itemCount > 0 && (
          <FlatList            ref={listRef}
            key={resetKey}
            data={items}
            keyExtractor={(item, i) =>
              item.kind === 'word' ? `w-${item.word.position}-${i}` : 'end'
            }
            renderItem={({ item }) => (
              <View style={{ height: viewport }}>
                {item.kind === 'word' ? (
                  <WordCard
                    position={item.word.position}
                    text={item.word.word}
                    meaning={item.word.meaning}
                    forms={item.word.forms}
                    ipa={item.word.ipa}
                    flagged={item.word.flagged}
                    onReplay={() => onSpeak?.(item.word)}
                    onToggleFlag={() => onToggleFlag?.(item.word)}
                  />
                ) : (
                  end?.render()
                )}
              </View>
            )}
            horizontal={false}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(_, i) => ({ length: viewport, offset: viewport * i, index: i })}
            initialScrollIndex={Math.min(index, itemCount - 1)}
            onMomentumScrollBegin={() => {
              // A real gesture is starting: drop any stale jump suppression
              // left behind by an instant scrollToIndex (which fires no
              // events — every programmatic jump here is instant).
              suppressSettle.current = false
            }}
            onMomentumScrollEnd={(event) => {
              if (suppressSettle.current) {
                suppressSettle.current = false
                return
              }
              settle(Math.round(event.nativeEvent.contentOffset.y / viewport))
            }}
          />
        )}
      </View>

      {(footerLeft || footerRight) && (
        <View
          pointerEvents="none"
          className="absolute bottom-9 left-0 right-0 flex-row items-center justify-between px-6"
        >
          <View>{footerLeft}</View>
          <View>{footerRight}</View>
        </View>
      )}
    </View>
  )
}
