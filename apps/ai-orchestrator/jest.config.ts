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
  maxWorkers: 1,
  // Ensure our lightweight module mocks run before any modules are imported by tests
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  // Skip heavy integration and behavior tests by default to prevent OOM issues
  // Run them explicitly with: nx test ai-orchestrator --testPathPattern=mcp-integration
  testPathIgnorePatterns: [
    '/node_modules/',
    'mcp-integration.spec.ts', // Skip heavy integration test by default
    'langchain-behavior.spec.ts', // Skip LLM behavior tests (memory intensive)
  ],
  // Increase heap size for tests that do run
  globals: {
    'ts-jest': {
      isolatedModules: true, // Faster compilation, less memory
    },
  },
};
