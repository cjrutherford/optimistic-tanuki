/// <reference types="jest" />

export default {
  displayName: 'wellness',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/wellness',
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  }
