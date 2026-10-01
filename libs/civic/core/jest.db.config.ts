import base from './jest.config';

/** Database tests: need CIVIC_TEST_DATABASE_URL (a Postgres database). */
export default {
  ...base,
  displayName: 'civic-core-db',
  testMatch: ['<rootDir>/test/db/**/*.test.ts'],
  globals: { civicTestSchemaScope: 'core' },
  // Real Postgres and whole pipeline runs; node:test had no default timeout.
  testTimeout: 60_000,
  testPathIgnorePatterns: ['/node_modules/'],
  globalSetup: '<rootDir>/test/db/helpers/global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/test/db/helpers/setup.ts'],
  coverageDirectory: '../../../coverage/libs/civic/core-db',
};
