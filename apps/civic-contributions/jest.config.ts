export default {
  displayName: 'civic-contributions',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+pdfjs-dist/.+\\.mjs$':
      '<rootDir>/../../libs/civic/adapters/jest.pdfjs-transform.cjs',
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // The civic libs keep ESM-style `.js` relative specifiers from the POC.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  // linkedom's DOM dependencies and pdfjs-dist ship as ES modules only.
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm|linkedom|css-select|css-what|domutils|dom-serializer|domhandler|domelementtype|entities|htmlparser2|nth-check|boolbase|uhyphen|html-escaper|cssom|pdfjs-dist)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/.*\\.db\\.spec\\.ts$',
  ],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
  coverageDirectory: '../../coverage/apps/civic-contributions',
};
