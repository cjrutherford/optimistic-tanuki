/* eslint-disable */
export default {
  displayName: 'permissions',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/permissions',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/main.ts',
    '!src/**/config.ts',
    '!src/**/loadDatabase.ts',
    '!src/**/staticDatabase.ts',
    '!src/**/seed-permissions.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.dto.ts',
    '!src/migrations/**',
    '!src/app-scopes/entities/**',
    '!src/permissions/entities/**',
    '!src/role-assignments/entities/**',
    '!src/roles/entities/**',
  ],
};
