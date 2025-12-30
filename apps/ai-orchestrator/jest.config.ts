export default {
  displayName: 'ai-orchestrator',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/ai-orchestrator',
  // Limit Jest workers for this heavy test suite to reduce memory pressure
  // and increase per-test timeout slightly for CI stability.
  maxWorkers: 1,
  testTimeout: 30000,
  // Ensure our lightweight module mocks run before any modules are imported by tests
  setupFiles: ['<rootDir>/src/test-setup.ts'],
};
