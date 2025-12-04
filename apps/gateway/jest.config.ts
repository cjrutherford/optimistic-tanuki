export default {
  displayName: 'gateway',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/gateway',
  coverageReporters: ['summary', 'json', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 75,
      lines: 70,
      statements: 70,
    },
  }
};