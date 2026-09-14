import fs from 'node:fs/promises';
import path from 'node:path';
import { buildDocsManifest } from './build-docs-manifest.mjs';

export const DEFAULT_MANIFEST_PATH =
  'apps/ui-playground/generated/docs-manifest.json';
export const DEFAULT_DOCS_OUTPUT_ROOT = 'apps/ui-playground/generated/docs';
export const DEFAULT_COMPODOC_INDEX_PATH =
  'apps/ui-playground/generated/compodoc-index.json';

/**
 * Mirrors Storybook's `sanitize()` (storybook/internal/csf), which turns a
 * title into the id used in `?path=/docs/<id>--docs` links.
 */
export function sanitizeStoryId(value) {
  return value
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function docsLink(title) {
  return `?path=/docs/${sanitizeStoryId(title)}--docs`;
}

function humanize(value) {
  return String(value)
    .replace(/\.md$/i, '')
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// A `/` inside a title segment would nest the sidebar entry one level deeper,
// and a `"` cannot appear in the string-literal `<Meta title>` Storybook indexes.
function titleSegment(value) {
  return String(value)
    .replace(/\s*\/\s*/g, ' - ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Storybook title for every manifest item, keyed by source path. Titles are
 * `Docs/<Category>/<Title>`; items whose ids would collide get a numeric
 * suffix, because Storybook rejects duplicate docs ids.
 */
export function buildDocTitles(items) {
  const usedIds = new Set();
  const titles = new Map();

  for (const item of items) {
    const base = `Docs/${titleSegment(humanize(item.category))}/${titleSegment(
      item.title
    )}`;
    let title = base;
    for (let n = 2; usedIds.has(sanitizeStoryId(title)); n++) {
      title = `${base} (${n})`;
    }
    usedIds.add(sanitizeStoryId(title));
    titles.set(item.sourcePath, title);
  }

  return titles;
}

/**
 * Point relative links between markdown files at the matching Storybook docs
 * page. Links to anything that is not a known markdown source are left alone.
 */
export function rewriteMarkdownLinks(body, sourcePath, titlesBySourcePath) {
  return body.replace(
    /(\]\()([^)\s]+)(\s+"[^"]*")?\)/g,
    (match, open, target, titleAttr = '') => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) {
        return match;
      }
      const [filePart] = target.split('#');
      if (!/\.md$/i.test(filePart)) {
        return match;
      }
      const resolved = filePart.startsWith('/')
        ? filePart.slice(1)
        : path.posix.normalize(
            path.posix.join(path.posix.dirname(sourcePath), filePart)
          );
      const title = titlesBySourcePath.get(resolved);
      return title ? `${open}${docsLink(title)}${titleAttr})` : match;
    }
  );
}

function mdxString(value) {
  return `{${JSON.stringify(value)}}`;
}

export function renderMarkdownDocMdx(title, contentModule) {
  return [
    "import { Meta, Markdown } from '@storybook/addon-docs/blocks';",
    `import content from './${contentModule}';`,
    '',
    // Storybook's indexer only accepts a string literal here.
    `<Meta title="${title}" />`,
    '',
    '<Markdown>{content}</Markdown>',
    '',
  ].join('\n');
}

export function renderOverviewMarkdown(items, titlesBySourcePath) {
  const byCategory = new Map();
  for (const item of items) {
    const category = humanize(item.category);
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category).push(item);
  }

  const sections = [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, entries]) => {
      const links = entries
        .sort(
          (left, right) =>
            (left.order ?? 999) - (right.order ?? 999) ||
            left.title.localeCompare(right.title)
        )
        .map((item) => {
          const summary = item.summary ? ` — ${item.summary}` : '';
          return `- [${item.title}](${docsLink(
            titlesBySourcePath.get(item.sourcePath)
          )})${summary}`;
        });
      return [`## ${category}`, '', ...links].join('\n');
    });

  return [
    '# Documentation',
    '',
    'Guides, architecture references, runbooks, and package notes from the repository, rendered from their markdown sources.',
    '',
    ...sections,
    '',
  ].join('\n');
}

export function renderApiReferenceMdx(libraries) {
  const rows = libraries.map((library) => {
    const link = library.available
      ? `<a href=${mdxString(library.url)} target="_blank" rel="noreferrer">${
          library.packageName
        }</a>`
      : `<code>${library.packageName}</code> (not generated)`;
    return `  <li><strong>${library.name}</strong>: ${link}. ${mdxString(
      library.summary
    )}</li>`;
  });

  return [
    "import { Meta } from '@storybook/addon-docs/blocks';",
    '',
    `<Meta title="Docs/API Reference" />`,
    '',
    '# API Reference',
    '',
    'Each library has generated compodoc documentation covering its components, services, and types. Component pages in this Storybook also show their inputs and outputs under **Docs**.',
    '',
    '<ul>',
    ...rows,
    '</ul>',
    '',
  ].join('\n');
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function buildStorybookDocs({
  workspaceRoot = process.cwd(),
  manifestPath = path.join(workspaceRoot, DEFAULT_MANIFEST_PATH),
  outputRoot = path.join(workspaceRoot, DEFAULT_DOCS_OUTPUT_ROOT),
  compodocIndexPath = path.join(workspaceRoot, DEFAULT_COMPODOC_INDEX_PATH),
} = {}) {
  const manifest = await buildDocsManifest({
    workspaceRoot,
    outputPath: manifestPath,
  });
  const items = manifest.items.filter((item) => item.kind === 'doc');
  const titles = buildDocTitles(items);

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  // Generated output: tells check-client-ui-heuristics to skip the directory.
  await fs.writeFile(path.join(outputRoot, '.gitignore'), '*\n');

  for (const item of items) {
    const base = path.join(outputRoot, item.slug);
    const contentModule = `${path.basename(item.slug)}.content.js`;
    const body = rewriteMarkdownLinks(item.body, item.sourcePath, titles);
    await fs.mkdir(path.dirname(base), { recursive: true });
    await fs.writeFile(
      path.join(path.dirname(base), contentModule),
      `export default ${JSON.stringify(body)};\n`
    );
    // `.docs.mdx`: addon-docs skips its MDX loader for files ending in
    // `story.mdx`/`stories.mdx`, which slugs such as `repo-story` would hit.
    await fs.writeFile(
      `${base}.docs.mdx`,
      renderMarkdownDocMdx(titles.get(item.sourcePath), contentModule)
    );
  }

  await fs.writeFile(
    path.join(outputRoot, 'overview.content.js'),
    `export default ${JSON.stringify(renderOverviewMarkdown(items, titles))};\n`
  );
  await fs.writeFile(
    path.join(outputRoot, 'overview.docs.mdx'),
    renderMarkdownDocMdx('Docs/Overview', 'overview.content.js')
  );

  const compodocIndex = await readJsonIfPresent(compodocIndexPath);
  await fs.writeFile(
    path.join(outputRoot, 'api-reference.docs.mdx'),
    renderApiReferenceMdx(compodocIndex?.items ?? [])
  );

  return { pages: items.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildStorybookDocs()
    .then(({ pages }) =>
      console.log(`Generated ${pages} Storybook docs pages.`)
    )
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
