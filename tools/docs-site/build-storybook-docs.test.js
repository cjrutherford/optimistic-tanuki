const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const load = () => import('./build-storybook-docs.mjs');

describe('build-storybook-docs', () => {
  describe('sanitizeStoryId', () => {
    it('matches the ids Storybook derives from docs titles', async () => {
      const { sanitizeStoryId, docsLink } = await load();

      expect(sanitizeStoryId('Docs/Getting Started/Local Setup (2)')).toBe(
        'docs-getting-started-local-setup-2'
      );
      expect(docsLink('Docs/API Reference')).toBe(
        '?path=/docs/docs-api-reference--docs'
      );
    });
  });

  describe('buildDocTitles', () => {
    it('nests docs by category and keeps slashes out of the leaf', async () => {
      const { buildDocTitles } = await load();

      const titles = buildDocTitles([
        {
          sourcePath: 'docs/guides/a.md',
          category: 'getting-started',
          title: 'Build / Deploy',
        },
      ]);

      expect(titles.get('docs/guides/a.md')).toBe(
        'Docs/Getting Started/Build - Deploy'
      );
    });

    it('suffixes titles that would produce a duplicate id', async () => {
      const { buildDocTitles } = await load();

      const titles = buildDocTitles([
        { sourcePath: 'docs/apps/a.md', category: 'apps', title: 'Overview' },
        { sourcePath: 'docs/apps/b.md', category: 'apps', title: 'Overview' },
      ]);

      expect(titles.get('docs/apps/a.md')).toBe('Docs/Apps/Overview');
      expect(titles.get('docs/apps/b.md')).toBe('Docs/Apps/Overview (2)');
    });
  });

  describe('rewriteMarkdownLinks', () => {
    const titles = new Map([
      ['docs/guides/setup.md', 'Docs/Guides/Setup'],
      ['README.md', 'Docs/Readme/Optimistic Tanuki'],
    ]);

    it('points relative and root-relative markdown links at docs pages', async () => {
      const { rewriteMarkdownLinks } = await load();

      const body = rewriteMarkdownLinks(
        'See [setup](./setup.md#install) and [home](/README.md "Home").',
        'docs/guides/intro.md',
        titles
      );

      expect(body).toBe(
        'See [setup](?path=/docs/docs-guides-setup--docs) and [home](?path=/docs/docs-readme-optimistic-tanuki--docs "Home").'
      );
    });

    it('leaves external, anchor, unknown, and non-markdown links alone', async () => {
      const { rewriteMarkdownLinks } = await load();
      const body =
        '[site](https://example.com/a.md) [top](#top) [gone](./missing.md) [img](./diagram.png)';

      expect(rewriteMarkdownLinks(body, 'docs/guides/intro.md', titles)).toBe(
        body
      );
    });
  });

  describe('buildStorybookDocs', () => {
    let tempRoot;

    beforeEach(async () => {
      tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'storybook-docs-'));
      await fs.mkdir(path.join(tempRoot, 'tools', 'docs-site'), {
        recursive: true,
      });
      await fs.mkdir(path.join(tempRoot, 'docs', 'guides'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(tempRoot, 'tools', 'docs-site', 'docs-source.config.json'),
        JSON.stringify({
          include: ['docs/**/*.md'],
          projectReadmes: [],
          exclude: [],
        })
      );
      await fs.writeFile(
        path.join(tempRoot, 'docs', 'guides', 'intro.md'),
        '# Intro\n\nRead [setup](./setup.md) next.\n'
      );
      await fs.writeFile(
        path.join(tempRoot, 'docs', 'guides', 'setup.md'),
        '# Setup\n\nInstall the workspace.\n'
      );
    });

    afterEach(async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    });

    it('writes a docs page per markdown source plus the overview and API reference', async () => {
      const { buildStorybookDocs } = await load();
      const outputRoot = path.join(tempRoot, 'generated', 'docs');

      const result = await buildStorybookDocs({
        workspaceRoot: tempRoot,
        manifestPath: path.join(tempRoot, 'generated', 'docs-manifest.json'),
        outputRoot,
        compodocIndexPath: path.join(tempRoot, 'generated', 'missing.json'),
      });

      expect(result).toEqual({ pages: 2 });

      const mdx = await fs.readFile(
        path.join(outputRoot, 'docs', 'guides', 'intro.docs.mdx'),
        'utf8'
      );
      expect(mdx).toContain('<Meta title="Docs/Guides/Intro" />');
      expect(mdx).toContain("import content from './intro.content.js';");

      const content = await fs.readFile(
        path.join(outputRoot, 'docs', 'guides', 'intro.content.js'),
        'utf8'
      );
      expect(content).toContain('?path=/docs/docs-guides-setup--docs');

      await expect(
        fs.readFile(path.join(outputRoot, 'overview.docs.mdx'), 'utf8')
      ).resolves.toContain('Docs/Overview');
      await expect(
        fs.readFile(path.join(outputRoot, 'api-reference.docs.mdx'), 'utf8')
      ).resolves.toContain('Docs/API Reference');
      await expect(
        fs.readFile(path.join(outputRoot, '.gitignore'), 'utf8')
      ).resolves.toBe('*\n');
    });
  });
});
