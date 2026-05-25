module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/build-docs-manifest.test.js',
    '<rootDir>/build-compodoc-index.test.js',
    '<rootDir>/compodoc-config.test.js',
  ],
};
