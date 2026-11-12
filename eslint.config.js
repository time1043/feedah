// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // `@data/*` is resolved by Metro, not by Node: metro.config.js maps it into
    // data/mock or data/real per bundle (EXPO_PUBLIC_DATASET). A static resolver
    // cannot know which folder the bundle will use, so leave that specifier to
    // the bundler instead of reporting a false positive.
    rules: {
      'import/no-unresolved': ['error', { ignore: ['^@data/'] }],
    },
  },
  {
    // The progress bar and the deck use the reference implementation's
    // (try/261107-drill-plugin) pattern: event callbacks, the imperative
    // handle and PanResponder read fresh state through useEffectEvent —
    // calling effect events from stale closures is exactly what they exist
    // for. The rules-of-hooks model and the compiler's manual memoization
    // pass don't recognize that pattern yet.
    files: ['src/components/progress-bar.tsx', 'src/components/word-deck.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
