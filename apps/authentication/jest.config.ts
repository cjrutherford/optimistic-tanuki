export default {
  displayName: 'authentication',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/authentication',
  coverageReporters: ['html', 'text', 'text-summary'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 80,
      lines: 95,
      statements: 95,
    },
  },
};