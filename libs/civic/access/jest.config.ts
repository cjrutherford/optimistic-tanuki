export default {
  displayName: 'civic-access',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // The sources keep ESM-style `.js` relative specifiers from the POC.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  // linkedom's DOM dependencies ship as ES modules only.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm|linkedom|css-select|css-what|domutils|dom-serializer|domhandler|domelementtype|entities|htmlparser2|nth-check|boolbase|uhyphen|html-escaper|cssom)/)',
  ],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  // Database tests need Postgres and run under the test-db target.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/db/'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/civic/access',
  coverageReporters: ['lcov', 'text', 'text-summary'],
};
