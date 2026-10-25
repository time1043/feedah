// Fixed TZ so date-dependent logic (local calendar days) is deterministic
// across developer machines; assertions are written against UTC.
process.env.TZ = 'UTC';

module.exports = {
  preset: 'jest-expo',

  // Logic tests only, colocated in __tests__. Component tests (*.test.tsx)
  // and the convex/ backend are deliberately out of scope.
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/convex/',
    '<rootDir>/android/',
    '<rootDir>/dist/',
  ],

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
