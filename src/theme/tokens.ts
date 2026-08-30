import type { Scheme } from './scheme';

export const palette = {
  light: {
    background: '#FFFFFF',
    surface: '#F0F0F3',
    surfacePressed: '#E0E1E6',
    text: '#000000',
    textSecondary: '#60646C',
    textTertiary: '#9A9EA6',
    accent: '#208AEF',
    success: '#3D9A50',
    danger: '#E5484D',
    track: '#D9D9DE',
    separator: '#E5E5EA',
  },
  dark: {
    background: '#000000',
    surface: '#212225',
    surfacePressed: '#2E3135',
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    textTertiary: '#7A7E86',
    accent: '#4CA0F0',
    success: '#5BB96F',
    danger: '#F0666B',
    track: '#3A3D42',
    separator: '#2A2C30',
  },
} as const;

export type ThemeColors = (typeof palette)[Scheme];

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const radius = {
  s: 8,
  m: 12,
  l: 20,
} as const;

export const fontSize = {
  caption: 13,
  body: 17,
  title: 28,
  metric: 56,
  word: 72,
} as const;
