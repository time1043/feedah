import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#208AEF', '#3D9A50', '#E5484D', '#F5B83D'];

type Piece = {
  left: number;
  color: string;
  size: number;
  spin: number;
  drift: number;
};

/**
 * One-shot confetti burst driven by a single animated value: every piece
 * interpolates its own fall height, sway and spin from it. Pure RN Animated
 * with the native driver — no extra dependency. Sits on top of an end page
 * with `pointerEvents="none"`.
 */
export function Confetti({ pieceCount = 60 }: { pieceCount?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useRef<Piece[]>(
    Array.from({ length: pieceCount }, () => ({
      left: Math.random(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 6,
      spin: (Math.random() * 2 + 1) * (Math.random() < 0.5 ? -1 : 1),
      drift: (Math.random() - 0.5) * 80,
    })),
  ).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={styles.root}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: `${piece.left * 100}%`,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size * 0.6,
            borderRadius: 1,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 900],
                }),
              },
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, piece.drift],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${piece.spin * 360}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
});
