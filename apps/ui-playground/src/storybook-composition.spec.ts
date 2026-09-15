import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '../../..');
const libsRoot = join(repoRoot, 'libs');

function librariesWithStorybook(): string[] {
  return readdirSync(libsRoot)
    .filter((lib) => existsSync(join(libsRoot, lib, '.storybook/main.ts')))
    .sort();
}

describe('ui-playground Storybook composition', () => {
  it('builds every library Storybook from the shared config factories', () => {
    for (const lib of librariesWithStorybook()) {
      const main = readFileSync(
        join(libsRoot, lib, '.storybook/main.ts'),
        'utf8'
      );
      const preview = readFileSync(
        join(libsRoot, lib, '.storybook/preview.ts'),
        'utf8'
      );

      expect({
        lib,
        usesSharedMain: main.includes('createLibraryStorybookConfig('),
      }).toEqual({ lib, usesSharedMain: true });
      expect({
        lib,
        usesSharedPreview: preview.includes('createPreview('),
      }).toEqual({ lib, usesSharedPreview: true });
    }
  });

  it('compiles the stories of every library Storybook it composes', () => {
    const tsconfig = JSON.parse(
      readFileSync(join(__dirname, '../.storybook/tsconfig.json'), 'utf8')
    ) as { include: string[] };

    const missing = librariesWithStorybook().filter(
      (lib) =>
        !tsconfig.include.includes(`../../../libs/${lib}/src/**/*.stories.ts`)
    );

    expect(missing).toEqual([]);
  });
});
