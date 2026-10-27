import { useEffectEvent, useMemo, useState } from 'react'
import { PanResponder, Text, View } from 'react-native'

type ProgressBarProps = {
  /** Current item index (0-based). */
  value: number
  /** Total item count, including the end page when there is one. */
  max: number
  /** Whether the bar can be grabbed and scrubbed. */
  scrubbable?: boolean
  /** Called with the target index when the gesture ends. Consumers enforce
   * their own policy (the feed, for example, treats a scrub as leaving
   * study mode). */
  onScrub: (index: number) => void
}

/**
 * Thin horizontal position bar that doubles as a scrubber: the thumb follows
 * the finger across the whole track and the raw index is reported on release.
 */
export function ProgressBar({ value, max, scrubbable = false, onScrub }: ProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const acceptsGrab = useEffectEvent(() => scrubbable)
  const indexAt = useEffectEvent((locationX: number): number => {
    if (trackWidth <= 0) return 0
    const ratio = Math.min(1, Math.max(0, locationX / trackWidth))
    return Math.max(0, Math.min(max - 1, Math.floor(ratio * max)))
  })
  const reportScrub = useEffectEvent((index: number) => onScrub(index))

  // Created once; the effect-event callbacks read fresh state on every call.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => acceptsGrab(),
        onMoveShouldSetPanResponder: () => acceptsGrab(),
        onPanResponderGrant: (event) => setDragIndex(indexAt(event.nativeEvent.locationX)),
        onPanResponderMove: (event) => setDragIndex(indexAt(event.nativeEvent.locationX)),
        onPanResponderRelease: (event) => {
          setDragIndex(null)
          reportScrub(indexAt(event.nativeEvent.locationX))
        },
        onPanResponderTerminate: () => setDragIndex(null),
      }),
    // The effect events are stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const shownIndex = dragIndex ?? value
  const fraction = max > 1 ? shownIndex / (max - 1) : 0

  return (
    <View className="py-3" {...panResponder.panHandlers}>
      <View
        className="h-1 bg-gray-300 dark:bg-gray-700 overflow-visible rounded-full"
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View className="h-1 bg-blue-500 rounded-full" style={{ width: `${fraction * 100}%` }} />
        {dragIndex !== null && (
          <View
            className="-top-2.5 h-6 min-w-6 bg-blue-500 px-1.5 absolute flex items-center justify-center rounded-full"
            style={{
              left: `${Math.min(100, Math.max(0, fraction * 100))}%`,
              marginLeft: -12,
            }}
          >
            <Text className="font-bold text-white text-[13px]">{dragIndex + 1}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
