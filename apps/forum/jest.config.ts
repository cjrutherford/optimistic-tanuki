/* eslint-disable */
export default {
  displayName: 'forum',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^isomorphic-dompurify$': '<rootDir>/src/test-setup.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(feed|@exodus|uuid)/)'],
  coverageDirectory: '../../coverage/apps/forum',
};
