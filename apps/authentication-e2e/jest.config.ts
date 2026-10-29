// These suites own isolated databases and containers, and validate their
// markers before mutating them. General CI has a different shared stack.
const privateFixtures: Record<string, string> = {
  'artifact-account-export': 'ARTIFACT_JOB_E2E_MARKER',
  'app-configurator-account-export': 'APP_CONFIGURATOR_JOB_E2E_MARKER',
  'social-account-export': 'SOCIAL_JOB_E2E_MARKER',
  'chat-account-export': 'CHAT_JOB_E2E_MARKER',
  'classifieds-account-export': 'CLASSIFIEDS_JOB_E2E_MARKER',
  'forum-account-export': 'FORUM_JOB_E2E_MARKER',
  'permissions-account-export': 'PERMISSIONS_JOB_E2E_MARKER',
  'payments-account-export': 'PAYMENTS_JOB_E2E_MARKER',
  'workspace-account-export': 'WORKSPACE_JOB_E2E_MARKER',
  'videos-account-export': 'VIDEOS_JOB_E2E_MARKER',
  'assets-account-export': 'ASSETS_JOB_E2E_MARKER',
  'selected-profile-ownership': 'SELECTED_PROFILE_J18_MARKER',
};
const unavailablePrivateFixtures = process.env.CI
  ? Object.entries(privateFixtures)
      .filter(([, marker]) => !process.env[marker])
      .map(([name]) => `<rootDir>/src/authentication/${name}\\.spec\\.ts$`)
  : [];
if (unavailablePrivateFixtures.length) {
  console.warn(
    'Private Authentication E2E fixtures not configured:',
    unavailablePrivateFixtures.join(', ')
  );
}

export default {
  displayName: 'authentication-e2e',
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
  coverageDirectory: '../../coverage/authentication-e2e',
};
