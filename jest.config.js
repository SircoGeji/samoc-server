module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/test/**/*.test.(ts|js)'],
  coverageReporters: ['json-summary', 'text', 'lcov'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,js}'],
  coveragePathIgnorePatterns: [
    'src/start.ts',
    'src/server.ts',
    'src/util/logger.ts',
    'src/util/secrets.ts',
    'src/controllers/db.ts',
    'src/controllers/plans/publishPlan.ts',
    'src/controllers/plans/updatePlan.ts',
  ],
  testEnvironment: 'node',
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
};
