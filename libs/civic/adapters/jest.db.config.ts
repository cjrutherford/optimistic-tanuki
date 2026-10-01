import base from './jest.config';

/** Database tests: need CIVIC_TEST_DATABASE_URL (a Postgres database). */
export default {
  ...base,
  displayName: 'civic-adapters-db',
  testMatch: ['<rootDir>/test/db/**/*.test.ts'],
  globals: { civicTestSchemaScope: 'adapters' },
  // Real Postgres and whole pipeline runs; node:test had no default timeout.
  testTimeout: 60_000,
  testPathIgnorePatterns: ['/node_modules/'],
  globalSetup: '<rootDir>/../core/test/db/helpers/global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/../core/test/db/helpers/setup.ts'],
  coverageDirectory: '../../../coverage/libs/civic/adapters-db',
};
