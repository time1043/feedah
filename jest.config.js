// Fixed TZ so date-dependent logic (local calendar days) is deterministic
// across developer machines; assertions are written against UTC.
process.env.TZ = 'UTC';

module.exports = {
  preset: 'jest-expo',

  // Suites live in tests/, mirroring the src/ tree (tests/lib/date.test.ts
  // covers src/lib/date.ts). Component tests (*.test.tsx) and the convex/
  // backend are deliberately out of scope.
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  clearMocks: true,

  // Coverage tracks logic only; React screens (.tsx) and the native sqlite
  // bootstrap (src/db/index.ts) cannot run under jest.
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/db/**/*.ts',
    'src/cloud/**/*.ts',
    '!src/**/*.tsx',
    '!src/db/index.ts',
  ],
};
