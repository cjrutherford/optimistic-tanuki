import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/angular';
import {
  getAbsolutePath,
  libraryStoriesEntries,
} from '../../../tools/storybook/main';

const configDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(configDir, '../../..');
const compodocOutput = resolve(configDir, '../generated/compodoc');

const config: StorybookConfig = {
  stories: [
    '../src/**/*.@(mdx|stories.ts)',
    '../generated/docs/**/*.mdx',
    // Every library's stories, taken from its own .storybook/main.ts.
    ...libraryStoriesEntries(resolve(workspaceRoot, 'libs'), configDir),
  ],
  addons: [getAbsolutePath('@storybook/addon-docs')],
  framework: {
    name: getAbsolutePath('@storybook/angular'),
    options: {},
  },
  staticDirs: [
    '../public',
    ...(existsSync(compodocOutput)
      ? [{ from: '../generated/compodoc', to: '/api' }]
      : []),
  ],
};

export default config;
