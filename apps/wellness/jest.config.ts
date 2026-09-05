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
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/main.ts',
    '!src/**/config.ts',
    '!src/**/loadDatabase.ts',
    '!src/**/staticDatabase.ts',
    '!src/**/*.entity.ts',
    '!src/**/entities/index.ts',
  ],
  testMatch: ['**/+(*.)+(spec).+(ts)'],
};
