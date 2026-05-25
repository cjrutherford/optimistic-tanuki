const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

describe('buildCompodocIndex', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'compodoc-index-'));
    await fs.mkdir(path.join(tempRoot, 'tools', 'docs-site'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempRoot, 'tools', 'docs-site', 'compodoc-libraries.json'),
      JSON.stringify(
        [
          {
            slug: 'common-ui',
            name: 'Common UI',
            packageName: '@optimistic-tanuki/common-ui',
            summary: 'Shared Angular primitives.',
            sourceRoot: 'libs/common-ui/src/lib/common-ui',
            readmePath: 'libs/common-ui/README.md',
            tsconfigPath: 'libs/common-ui/tsconfig.doc.json',
          },
        ],
        null,
        2
      )
    );
  });

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds an index even when compodoc is not installed locally', async () => {
    const { buildCompodocIndex } = await import('./build-compodoc-index.mjs');

    const manifest = await buildCompodocIndex({
      workspaceRoot: tempRoot,
      configPath: path.join(
        tempRoot,
        'tools',
        'docs-site',
        'compodoc-libraries.json'
      ),
      outputPath: path.join(tempRoot, 'compodoc-index.json'),
      outputRoot: path.join(tempRoot, 'compodoc'),
    });

    expect(manifest.items).toEqual([
      expect.objectContaining({
        slug: 'common-ui',
        available: false,
        url: '/generated/compodoc/common-ui/index.html',
      }),
    ]);
  });

  it('marks a library available when an index file exists in the configured output root', async () => {
    await fs.mkdir(path.join(tempRoot, 'compodoc', 'common-ui'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempRoot, 'compodoc', 'common-ui', 'index.html'),
      '<html></html>'
    );

    const { buildCompodocIndex } = await import('./build-compodoc-index.mjs');

    const manifest = await buildCompodocIndex({
      workspaceRoot: tempRoot,
      configPath: path.join(
        tempRoot,
        'tools',
        'docs-site',
        'compodoc-libraries.json'
      ),
      outputPath: path.join(tempRoot, 'compodoc-index.json'),
      outputRoot: path.join(tempRoot, 'compodoc'),
    });

    expect(manifest.items).toEqual([
      expect.objectContaining({
        slug: 'common-ui',
        available: true,
      }),
    ]);
  });

  it('skips regeneration when the existing output is newer than source inputs', async () => {
    await fs.mkdir(path.join(tempRoot, 'libs', 'common-ui', 'src', 'lib'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempRoot, 'libs', 'common-ui', 'src', 'lib', 'button.ts'),
      'export const button = true;'
    );
    await fs.writeFile(
      path.join(tempRoot, 'libs', 'common-ui', 'README.md'),
      '# Common UI'
    );
    await fs.writeFile(
      path.join(tempRoot, 'libs', 'common-ui', 'tsconfig.doc.json'),
      '{}'
    );
    await fs.mkdir(path.join(tempRoot, 'compodoc', 'common-ui'), {
      recursive: true,
    });
    const outputPath = path.join(
      tempRoot,
      'compodoc',
      'common-ui',
      'index.html'
    );
    await fs.writeFile(outputPath, '<html></html>');

    const future = new Date(Date.now() + 60_000);
    await fs.utimes(outputPath, future, future);

    const { buildCompodocIndex } = await import('./build-compodoc-index.mjs');
    const runCompodocFn = jest.fn();

    const manifest = await buildCompodocIndex({
      workspaceRoot: tempRoot,
      configPath: path.join(
        tempRoot,
        'tools',
        'docs-site',
        'compodoc-libraries.json'
      ),
      outputPath: path.join(tempRoot, 'compodoc-index.json'),
      outputRoot: path.join(tempRoot, 'compodoc'),
      compodocAvailable: true,
      runCompodocFn,
    });

    expect(runCompodocFn).not.toHaveBeenCalled();
    expect(manifest.items).toEqual([
      expect.objectContaining({
        slug: 'common-ui',
        available: true,
      }),
    ]);
  });

  it('regenerates when source inputs are newer than the existing output', async () => {
    await fs.mkdir(path.join(tempRoot, 'libs', 'common-ui', 'src', 'lib'), {
      recursive: true,
    });
    const sourcePath = path.join(
      tempRoot,
      'libs',
      'common-ui',
      'src',
      'lib',
      'button.ts'
    );
    await fs.writeFile(sourcePath, 'export const button = true;');
    await fs.writeFile(
      path.join(tempRoot, 'libs', 'common-ui', 'README.md'),
      '# Common UI'
    );
    await fs.writeFile(
      path.join(tempRoot, 'libs', 'common-ui', 'tsconfig.doc.json'),
      '{}'
    );
    await fs.mkdir(path.join(tempRoot, 'compodoc', 'common-ui'), {
      recursive: true,
    });
    const indexPath = path.join(
      tempRoot,
      'compodoc',
      'common-ui',
      'index.html'
    );
    await fs.writeFile(indexPath, '<html></html>');

    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    await fs.utimes(indexPath, past, past);
    await fs.utimes(sourcePath, future, future);

    const { buildCompodocIndex } = await import('./build-compodoc-index.mjs');
    const runCompodocFn = jest.fn(
      async (_workspaceRoot, _library, outputDir) => {
        await fs.writeFile(
          path.join(outputDir, 'index.html'),
          '<html>new</html>'
        );
      }
    );

    await buildCompodocIndex({
      workspaceRoot: tempRoot,
      configPath: path.join(
        tempRoot,
        'tools',
        'docs-site',
        'compodoc-libraries.json'
      ),
      outputPath: path.join(tempRoot, 'compodoc-index.json'),
      outputRoot: path.join(tempRoot, 'compodoc'),
      compodocAvailable: true,
      runCompodocFn,
    });

    expect(runCompodocFn).toHaveBeenCalledTimes(1);
  });
});
