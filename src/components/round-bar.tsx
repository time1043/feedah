import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import { Canvas, Rect } from '@shopify/react-native-skia';

import { useTheme } from '@/theme/context';

export type RoundWordStatus = 'green' | 'red' | 'gray';

type RoundBarProps = {
  /** One entry per word in bucket order. */
  statuses: RoundWordStatus[];
};

/**
 * One-word-per-pixel horizontal timeline of a round, drawn with Skia so a
 * 2000-word bucket stays a single cheap GPU draw instead of thousands of
 * views. Red = flagged during the round, green = hand-settled, gray = skipped.
 */
export function RoundBar({ statuses }: RoundBarProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const slotWidth = statuses.length > 0 && width > 0 ? width / statuses.length : 0;
  const colorOf = (status: RoundWordStatus) =>
    status === 'red' ? colors.danger : status === 'green' ? colors.success : colors.track;

  return (
    <Canvas onLayout={onLayout} style={styles.canvas}>
      {statuses.map((status, index) => (
        <Rect
          key={index}
          x={index * slotWidth}
          y={0}
          width={Math.max(slotWidth, 0.5)}
          height={14}
          color={colorOf(status)}
        />
      ))}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 3,
    height: 14,
    width: '100%',
  },
});
