export default {
  displayName: 'telos-docs-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/telos-docs-service',
    coverageThreshold: {
    global: {
      branches: 20,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
