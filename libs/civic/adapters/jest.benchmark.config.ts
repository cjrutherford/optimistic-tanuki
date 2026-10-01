import base from './jest.config';

/** Live discovery benchmark (P1.7): network-bound, run on demand only. */
export default {
  ...base,
  displayName: 'civic-adapters-benchmark',
  testMatch: ['<rootDir>/benchmark/**/*.bench.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  // The harness moves into CIVIC_BENCH_OUT itself, after resolving its paths.
  setupFilesAfterEnv: [],
  testTimeout: 30 * 60 * 1000,
};
