import base from './jest.config';

/** Database tests (*.db.spec.ts): need CIVIC_TEST_DATABASE_URL. Shares civic-core's Postgres helpers. */
export default {
  ...base,
  displayName: 'civic-contributions-db',
  testMatch: ['<rootDir>/src/**/*.db.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  globals: { civicTestSchemaScope: 'contributions' },
  globalSetup:
    '<rootDir>/../../libs/civic/core/test/db/helpers/global-setup.ts',
  setupFilesAfterEnv: [
    '<rootDir>/../../libs/civic/core/test/db/helpers/setup.ts',
  ],
  // Real Postgres and whole pipeline runs.
  testTimeout: 60_000,
  coverageDirectory: '../../coverage/apps/civic-contributions-db',
};
