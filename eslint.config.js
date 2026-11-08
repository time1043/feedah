// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The progress bar is a verbatim port of the reference implementation
    // (try/261107-drill-plugin): PanResponder reads fresh state through
    // useEffectEvent on purpose — calling effect events from stale closures
    // is exactly what they exist for. The rules-of-hooks model and the
    // compiler's manual memoization pass don't recognize that pattern yet.
    files: ['src/components/progress-bar.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
