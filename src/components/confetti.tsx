import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

const COLORS = ['#208AEF', '#3D9A50', '#E5484D', '#F5B83D'];
const GRAVITY = 2600; // px/s², tuned for phone-scale parabolas
const FLIGHT_MS = 2200; // matches the end-page linger
const KEYFRAMES = 14; // samples along each piece's parabola

type Piece = {
  color: string;
  size: number;
  spin: number;
  /** Progress (0..1) → (x, y) samples of the piece's projectile path. */
  xs: number[];
  ys: number[];
};

function buildPieces(count: number, width: number, height: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2; // 0 = left cannon, 1 = right cannon
    const originX = side === 0 ? -12 : width + 12;
    const originY = height * 0.94;
    // Aim across the middle band so the two cannons crossfire.
    const aim = width * (side === 0 ? 0.18 + Math.random() * 0.37 : 0.45 + Math.random() * 0.37);
    const apexY = height * (0.1 + Math.random() * 0.2);
    const tApex = 0.7 + Math.random() * 0.3; // seconds to reach the apex
    const vx = (aim - originX) / tApex;
    // vy so that the piece passes through (aim, apexY) while decelerating.
    const vy = (apexY - originY) / tApex - 0.5 * GRAVITY * tApex;

    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= KEYFRAMES; k++) {
      const t = (k / KEYFRAMES) * (FLIGHT_MS / 1000);
      xs.push(originX + vx * t);
      ys.push(originY + vy * t + 0.5 * GRAVITY * t * t);
    }

    pieces.push({
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 6,
      spin: (Math.random() * 2 + 1) * (Math.random() < 0.5 ? -1 : 1),
      xs,
      ys,
    });
  }
  return pieces;
}

/**
 * Two cannons at the bottom corners fire paper toward the upper middle; each
 * piece then falls along a real parabola (gravity). One shared animated value
 * drives everything: each piece samples its own precomputed trajectory from
 * it, so the whole burst stays on the native driver with no dependency.
 */
export function Confetti({ active = true, pieceCount = 140 }: { pieceCount?: number; active?: boolean }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useRef(buildPieces(pieceCount, width, height)).current;

  useEffect(() => {
    // Wait until the end page is actually reached, or the burst plays early.
    if (!active || width === 0) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: FLIGHT_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [active, progress, width]);

  return (
    <View pointerEvents="none" style={styles.root}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: piece.size,
            height: piece.size * 0.6,
            borderRadius: 1,
            backgroundColor: piece.color,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: piece.xs.map((_, k) => k / KEYFRAMES),
                  outputRange: piece.xs,
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: piece.xs.map((_, k) => k / KEYFRAMES),
                  outputRange: piece.ys,
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${piece.spin * 540}deg`],
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
