/** Bounded integration fixture; infrastructure must already be privately prepared. */
export default {
  displayName: 'deletion-private',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/support/deletion-private-setup.ts',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: [
    '<rootDir>/src/authentication/d27-multiprocess.spec.ts',
    '<rootDir>/src/authentication/d27-owner-worker.spec.ts',
    '<rootDir>/src/authentication/deletion-finalization.spec.ts',
    '<rootDir>/src/authentication/payments-account-deletion.spec.ts',
    '<rootDir>/src/authentication/classifieds-account-deletion.spec.ts',
    '<rootDir>/src/authentication/chat-account-deletion.spec.ts',
    '<rootDir>/src/authentication/app-configurator-account-deletion.spec.ts',
    '<rootDir>/src/authentication/forum-workspace-account-deletion.spec.ts',
    '<rootDir>/src/authentication/social-account-deletion.spec.ts',
    '<rootDir>/src/authentication/profile-account-deletion.spec.ts',
    '<rootDir>/src/authentication/assets-account-deletion.spec.ts',
    '<rootDir>/src/authentication/videos-account-deletion.spec.ts',
    '<rootDir>/src/authentication/permissions-account-deletion.spec.ts',
  ],
};
