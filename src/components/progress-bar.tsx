import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { fontSize } from '@/theme/tokens';

type ProgressBarProps = {
  /** Current item index (0-based). */
  value: number;
  /** Total item count. */
  max: number;
  /** Highest index the scrubber may target; forward progress is swipe-only. */
  maxIndex: number;
  /** Whether the bar can be grabbed and scrubbed. */
  interactive: boolean;
  /** Called with the target index when the gesture ends. */
  onScrub: (index: number) => void;
};

/**
 * Thin horizontal position bar. Doubles as a scrubber when interactive:
 * dragging shows the target position and jumps on release. Scrubbing is
 * clamped to maxIndex so the feed can never be dragged past learned words.
 */
export function ProgressBar({ value, max, maxIndex, interactive, onScrub }: ProgressBarProps) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const stateRef = useRef({ interactive, max, maxIndex, trackWidth });
  stateRef.current = { interactive, max, maxIndex, trackWidth };

  const indexAt = (x: number): number => {
    const { max: maxCount, maxIndex: clamp, trackWidth: width } = stateRef.current;
    if (width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, x / width));
    return Math.max(0, Math.min(clamp, Math.floor(ratio * maxCount)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current.interactive,
      onMoveShouldSetPanResponder: () => stateRef.current.interactive,
      onPanResponderGrant: (event) => setDragIndex(indexAt(event.nativeEvent.locationX)),
      onPanResponderMove: (event) => setDragIndex(indexAt(event.nativeEvent.locationX)),
      onPanResponderRelease: (event) => {
        const index = indexAt(event.nativeEvent.locationX);
        setDragIndex(null);
        onScrub(index);
      },
      onPanResponderTerminate: () => setDragIndex(null),
    }),
  ).current;

  const shownIndex = dragIndex ?? value;
  const fraction = max > 1 ? shownIndex / (max - 1) : 0;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View
        style={[styles.track, { backgroundColor: colors.track }]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.fill, { backgroundColor: colors.accent, width: `${fraction * 100}%` }]} />
        {dragIndex !== null && (
          <View
            style={[
              styles.thumb,
              {
                backgroundColor: colors.accent,
                left: `${Math.min(100, Math.max(0, fraction * 100))}%`,
              },
            ]}>
            <Text style={styles.thumbText}>{dragIndex + 1}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  track: {
    borderRadius: 2,
    height: 4,
    overflow: 'visible',
  },
  fill: {
    borderRadius: 2,
    height: 4,
  },
  thumb: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    marginLeft: -12,
    minWidth: 24,
    paddingHorizontal: 6,
    position: 'absolute',
    top: -10,
  },
  thumbText: {
    color: '#FFFFFF',
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
});
