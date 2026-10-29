// These suites require isolated private services, not the shared CI stack.
const privateFixtures: Record<string, string> = {
  'profile-analytics-ownership': 'PROFILE_ANALYTICS_J19_MARKER',
  'presence-audience': 'PRESENCE_J20_MARKER',
  'presence-actor-binding': 'PRESENCE_J17_MARKER',
  'notification-provenance': 'NOTIFICATION_J21_MARKER',
};
const unavailablePrivateFixtures = process.env.CI
  ? Object.entries(privateFixtures)
      .filter(([, marker]) => !process.env[marker])
      .map(([name]) => `<rootDir>/src/gateway/${name}\\.spec\\.ts$`)
  : [];
if (unavailablePrivateFixtures.length) {
  console.warn(
    'Private Gateway E2E fixtures not configured:',
    unavailablePrivateFixtures.join(', ')
  );
}

export default {
  displayName: 'gateway-e2e',
  preset: '../../jest.preset.js',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  setupFiles: ['<rootDir>/src/support/test-setup.ts'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', ...unavailablePrivateFixtures],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/gateway-e2e',
};
