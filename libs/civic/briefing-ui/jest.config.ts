export default {
  displayName: 'civic-briefing-ui',
  preset: '../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../../coverage/libs/civic/briefing-ui',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // marked ships ESM only, so it is transformed rather than skipped; the
  // `.*` reaches past pnpm's node_modules/.pnpm/marked@x/node_modules/ nesting.
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|.*marked)'],
};
