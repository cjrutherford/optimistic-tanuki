export default {
  displayName: 'local-hub',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/local-hub',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // marked (via civic-briefing-ui) ships ESM only, so it is transformed; the
  // `.*` reaches past pnpm's node_modules/.pnpm/marked@x/node_modules/ nesting.
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|.*marked)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
