import nxEslint from '@nx/eslint/plugin';

export default [
  ...nxEslint.configs['flat/base'],
  ...nxEslint.configs['flat/typescript'],
  {
    rules: {},
  },
];
