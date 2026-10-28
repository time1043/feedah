// Fixed TZ so date-dependent logic (local calendar days) is deterministic
// across developer machines; assertions are written against UTC.
process.env.TZ = 'UTC'

module.exports = {
  preset: 'jest-expo',

  // Suites live in tests/, mirroring the src/ tree (tests/study/logic.test.ts
  // covers src/study/logic.ts). Component tests (*.test.tsx) are out of scope.
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  clearMocks: true,

  // Coverage tracks logic only; React screens (.tsx) cannot run under jest.
  collectCoverageFrom: ['src/study/**/*.ts', 'src/lib/**/*.ts', '!src/**/*.tsx'],
}
