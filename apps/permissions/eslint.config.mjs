import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import baseConfig from '../../eslint.config.mjs';
import jsoncParser from 'jsonc-eslint-parser';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...baseConfig,
  ...compat
    .config({
      extends: [
        'plugin:@nx/typescript',
        'plugin:@typescript-eslint/recommended',
      ],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        ...config.rules,
      },
    })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': 'error',
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
];
