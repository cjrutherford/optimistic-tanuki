export default {
  displayName: 'blogging',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    '^.+\\.mjs$': [
      'babel-jest',
      { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
  coverageDirectory: '../../coverage/apps/blogging',
  transformIgnorePatterns: [
    'node_modules/(?!(feed|@exodus|isomorphic-dompurify|@asamuzakjp|@csstools|parse5|@bramus|tough-cookie)/)',
  ],
}
