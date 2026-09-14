import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import type { StorybookConfig } from '@storybook/angular';

const require = createRequire(import.meta.url);

/** Where a library's stories live, relative to its `.storybook` directory. */
const LIBRARY_STORIES_DIRECTORY = '../src';

export function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

/**
 * Storybook main config for a UI library.
 *
 * Stories are found under the library's `src` and grouped in the sidebar
 * under `titlePrefix`. ui-playground reads every library's
 * `.storybook/main.ts` (see `libraryStoriesEntries`) to build the combined
 * Storybook, so a library's stories appear there exactly as they do in its
 * own Storybook.
 */
export function createLibraryStorybookConfig(
  titlePrefix: string,
  overrides: Partial<StorybookConfig> = {}
): StorybookConfig {
  return {
    stories: [{ directory: LIBRARY_STORIES_DIRECTORY, titlePrefix }],
    addons: [getAbsolutePath('@storybook/addon-docs')],
    framework: {
      name: getAbsolutePath('@storybook/angular'),
      options: {},
    },
    ...overrides,
  };
}

/**
 * The stories entries of every library Storybook under `libsRoot`, re-rooted
 * at `configDir`.
 *
 * Library configs are read, not imported: Storybook only transpiles the main
 * config it loads itself, so a runtime `import()` of another `.ts` config
 * fails. A library whose config does not call `createLibraryStorybookConfig`
 * is an error rather than being silently left out.
 */
export function libraryStoriesEntries(libsRoot: string, configDir: string) {
  return readdirSync(libsRoot)
    .sort()
    .filter((lib) => existsSync(join(libsRoot, lib, '.storybook/main.ts')))
    .map((lib) => {
      const libConfigDir = join(libsRoot, lib, '.storybook');
      const source = readFileSync(join(libConfigDir, 'main.ts'), 'utf8');
      const match = /createLibraryStorybookConfig\(\s*'([^']+)'/.exec(source);
      if (!match) {
        throw new Error(
          `${lib}/.storybook/main.ts must use createLibraryStorybookConfig('<title prefix>') to be included in ui-playground.`
        );
      }
      return {
        directory: relative(
          configDir,
          join(libConfigDir, LIBRARY_STORIES_DIRECTORY)
        ),
        titlePrefix: match[1],
      };
    });
}
