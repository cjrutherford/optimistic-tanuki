import nx from '@nx/eslint-plugin';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularParser from '@angular-eslint/template-parser';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@angular-eslint': angular,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allowCircularSelfDependency: true,
          allow: [
            '@optimistic-tanuki/database',
            '@optimistic-tanuki/encryption',
            '@optimistic-tanuki/logger',
            '@optimistic-tanuki/app-config-models',
            '@optimistic-tanuki/theme-models',
            '@optimistic-tanuki/auth-ui',
            '@optimistic-tanuki/common-ui',
            '@optimistic-tanuki/motion-ui',
            '@optimistic-tanuki/notification-ui',
            '@optimistic-tanuki/permission-lib',
            '@optimistic-tanuki/theme-lib',
            '@optimistic-tanuki/ui-models',
          ],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:domain',
                'type:contracts',
                'type:ui',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:data-access',
                'type:contracts',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:contracts', 'type:util'],
            },
            {
              sourceTag: 'type:contracts',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: ['scope:auth', 'scope:shared'],
            },
            {
              sourceTag: 'scope:permissions',
              onlyDependOnLibsWithTags: ['scope:permissions', 'scope:shared'],
            },
            {
              sourceTag: 'scope:payments',
              onlyDependOnLibsWithTags: ['scope:payments', 'scope:shared'],
            },
            {
              sourceTag: 'scope:finance',
              onlyDependOnLibsWithTags: ['scope:finance', 'scope:shared'],
            },
            {
              sourceTag: 'scope:leads',
              onlyDependOnLibsWithTags: ['scope:leads', 'scope:shared'],
            },
            {
              sourceTag: 'platform:web',
              notDependOnLibsWithTags: ['platform:server'],
            },
            {
              sourceTag: 'visibility:publishable',
              onlyDependOnLibsWithTags: [
                'visibility:publishable',
                'type:contracts',
                'type:util',
              ],
            },
          ],
        },
      ],
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'prefer-const': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: ['**/*.html'],
    plugins: {
      '@angular-eslint/template': angularTemplate,
    },
    languageOptions: {
      parser: angularParser,
    },
    rules: {},
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];
