export default {
  displayName: 'chat-ui',
  preset: '../../jest.preset.js',
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts', '<rootDir>/src/lib/chat-ui/chat-window/message-list/message-list.component.spec.ts'],
  coverageDirectory: '../../coverage/libs/chat-ui',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
