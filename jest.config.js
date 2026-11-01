// Fixed TZ so date-dependent logic (local calendar days) is deterministic
// across developer machines; assertions are written against UTC.
process.env.TZ = 'UTC'

module.exports = {
  preset: 'jest-expo',

  // Suites live in tests/, mirroring the src/ tree. *.test.tsx files are
  // react-test-renderer probes (no DOM), currently only the study-session
  // wiring suite.
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],

  clearMocks: true,
}
