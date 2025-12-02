export default {
  displayName: 'authentication',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/authentication',
  coverageReporters: ['html', 'text', 'text-summary'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 55,
      lines: 55,
      statements: 55,
    },
  },
};