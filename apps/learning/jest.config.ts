export default {
  displayName: 'learning',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/learning',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // marked ships ESM only, so it has to be transformed rather than skipped.
  // The `.*` matters: pnpm nests the real file under
  // node_modules/.pnpm/marked@x.y.z/node_modules/marked/, so a lookahead
  // anchored right after the first `node_modules/` never sees the name.
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|.*marked)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
