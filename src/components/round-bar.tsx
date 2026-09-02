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
 * Horizontal timeline of a round, drawn with Skia. Words are aggregated into
 * one-pixel columns (red wins over green over gray): a 2000-word bucket on a
 * ~360dp bar cannot be resolved per word, and one rect per pixel keeps the
 * draw cheap and every red word visible.
 */
export function RoundBar({ statuses }: RoundBarProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const columns: RoundWordStatus[] = [];
  if (width > 0 && statuses.length > 0) {
    const pixelCount = Math.min(statuses.length, Math.round(width));
    const groupSize = statuses.length / pixelCount;
    for (let pixel = 0; pixel < pixelCount; pixel++) {
      const start = Math.floor(pixel * groupSize);
      const end =
        pixel === pixelCount - 1
          ? statuses.length
          : Math.min(statuses.length, Math.floor((pixel + 1) * groupSize));
      let column: RoundWordStatus = 'gray';
      for (let i = start; i < end; i++) {
        if (statuses[i] === 'red') {
          column = 'red';
          break;
        }
        if (statuses[i] === 'green') {
          column = 'green';
        }
      }
      columns.push(column);
    }
  }

  const colorOf = (status: RoundWordStatus) =>
    status === 'red' ? colors.danger : status === 'green' ? colors.success : colors.track;

  return (
    <Canvas onLayout={onLayout} style={styles.canvas}>
      {columns.map((column, index) => (
        <Rect key={index} x={index} y={0} width={1} height={14} color={colorOf(column)} />
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
