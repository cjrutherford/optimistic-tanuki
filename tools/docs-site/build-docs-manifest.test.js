const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

describe('buildDocsManifest', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-site-'));

    await fs.mkdir(path.join(tempRoot, 'docs', 'getting-started'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempRoot, 'docs', 'guides'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'apps', 'demo-app'), {
      recursive: true,
    });

    await fs.writeFile(
      path.join(tempRoot, 'README.md'),
      '# Optimistic Tanuki\n\nTop level workspace summary.\n'
    );
    await fs.writeFile(
      path.join(tempRoot, 'docs', 'getting-started', 'README.md'),
      [
        '---',
        'title: Getting Started',
        'summary: Start here first.',
        'category: onboarding',
        'tags:',
        '  - setup',
        '  - contributors',
        '---',
        '',
        '# Getting Started',
        '',
        'Bring the stack up quickly.',
      ].join('\n')
    );
    await fs.writeFile(
      path.join(tempRoot, 'docs', 'guides', 'workflow-deck.md'),
      [
        '---',
        'title: Workflow Deck',
        'docType: deck',
        'summary: Contributor workflow slides.',
        '---',
        '',
        '# Slide 1',
        '',
        'Welcome',
        '',
        '---',
        '',
        '# Slide 2',
        '',
        '`pnpm run docker:dev`',
      ].join('\n')
    );
    await fs.writeFile(
      path.join(tempRoot, 'apps', 'demo-app', 'README.md'),
      '# Demo App\n\nSelected project readme.\n'
    );
    await fs.writeFile(
      path.join(tempRoot, 'docs-source.config.json'),
      JSON.stringify(
        {
          include: ['README.md', 'docs/**/*.md'],
          projectReadmes: ['apps/demo-app/README.md'],
          exclude: ['docs/**/draft-*.md'],
        },
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

  it('builds a deterministic manifest from configured markdown sources', async () => {
    const { buildDocsManifest } = await import('./build-docs-manifest.mjs');

    const manifest = await buildDocsManifest({
      workspaceRoot: tempRoot,
      configPath: path.join(tempRoot, 'docs-source.config.json'),
      outputPath: path.join(tempRoot, 'docs-manifest.json'),
    });

    expect(manifest.version).toBe(1);
    expect(manifest.generatedAt).toEqual(expect.any(String));
    expect(manifest.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'readme',
          sourcePath: 'README.md',
          kind: 'doc',
          title: 'Optimistic Tanuki',
        }),
        expect.objectContaining({
          slug: 'docs/getting-started/readme',
          sourcePath: 'docs/getting-started/README.md',
          title: 'Getting Started',
          category: 'onboarding',
          tags: ['setup', 'contributors'],
        }),
        expect.objectContaining({
          slug: 'docs/guides/workflow-deck',
          sourcePath: 'docs/guides/workflow-deck.md',
          kind: 'deck',
        }),
        expect.objectContaining({
          slug: 'apps/demo-app/readme',
          sourcePath: 'apps/demo-app/README.md',
        }),
      ])
    );

    expect(
      manifest.items.find(
        (item) => item.sourcePath === 'docs/getting-started/README.md'
      )?.headings
    ).toEqual([{ depth: 1, text: 'Getting Started', id: 'getting-started' }]);
    expect(
      manifest.items.find(
        (item) => item.sourcePath === 'docs/guides/workflow-deck.md'
      )?.summary
    ).toBe('Contributor workflow slides.');
    expect(
      manifest.items.find((item) => item.sourcePath === 'README.md')?.body
    ).toContain('Top level workspace summary.');
  });
});
