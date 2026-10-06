import base from './jest.config';

/** Database tests: need CIVIC_TEST_DATABASE_URL. Shares civic-core's Postgres test helpers. */
export default {
  ...base,
  displayName: 'civic-llm-db',
  testMatch: ['<rootDir>/test/db/**/*.test.ts'],
  globals: { civicTestSchemaScope: 'llm' },
  // Real Postgres and whole pipeline runs; node:test had no default timeout.
  testTimeout: 60_000,
  testPathIgnorePatterns: ['/node_modules/'],
  globalSetup: '<rootDir>/../core/test/db/helpers/global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/../core/test/db/helpers/setup.ts'],
  coverageDirectory: '../../../coverage/libs/civic/llm-db',
};
