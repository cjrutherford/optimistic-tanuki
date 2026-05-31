import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const DEFAULT_CONFIG_PATH = 'tools/docs-site/docs-source.config.json';
const DEFAULT_OUTPUT_PATH =
  'apps/ui-playground/public/generated/docs-manifest.json';

function slugifySegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sourcePathToSlug(sourcePath) {
  return sourcePath
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .split('/')
    .map((segment) => slugifySegment(segment) || segment.toLowerCase())
    .join('/');
}

function humanizeSlug(value) {
  return value
    .split(/[-_/]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return { data: {}, body: markdown };
  }

  const endIndex = markdown.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { data: {}, body: markdown };
  }

  const rawFrontmatter = markdown.slice(4, endIndex);
  const body = markdown.slice(endIndex + 5);
  return {
    data: yaml.load(rawFrontmatter) ?? {},
    body,
  };
}

function extractHeadings(markdownBody) {
  return markdownBody
    .split(/\r?\n/)
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => {
      const text = match[2].trim();
      return {
        depth: match[1].length,
        text,
        id: slugifySegment(text),
      };
    });
}

function extractSummary(markdownBody) {
  const lines = markdownBody.split(/\r?\n/);
  let inFence = false;
  const summaryLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }

    if (inFence || !trimmed || trimmed.startsWith('#')) {
      continue;
    }

    summaryLines.push(trimmed);
    if (summaryLines.join(' ').length > 140) {
      break;
    }
  }

  return summaryLines.join(' ').trim();
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPreviousManifest(outputPath) {
  try {
    return JSON.parse(await fs.readFile(outputPath, 'utf8'));
  } catch {
    return undefined;
  }
}

function comparableManifestItem(item) {
  const { lastUpdated, ...rest } = item;
  return rest;
}

function itemContentMatches(left, right) {
  return (
    JSON.stringify(comparableManifestItem(left)) ===
    JSON.stringify(comparableManifestItem(right))
  );
}

async function collectRecursiveMarkdownPaths(workspaceRoot, rootDir) {
  const absoluteRoot = path.join(workspaceRoot, rootDir);
  if (!(await pathExists(absoluteRoot))) {
    return [];
  }

  const entries = await fs.readdir(absoluteRoot, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(
        ...(await collectRecursiveMarkdownPaths(workspaceRoot, relativePath))
      );
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(relativePath);
    }
  }

  return results;
}

function matchesExcludePattern(sourcePath, pattern) {
  const normalizedPattern = pattern.replace(/\\/g, '/');
  if (normalizedPattern === sourcePath) {
    return true;
  }

  if (normalizedPattern.endsWith('/**/*.md')) {
    const prefix = normalizedPattern.slice(0, -'/**/*.md'.length);
    return sourcePath.startsWith(`${prefix}/`) && sourcePath.endsWith('.md');
  }

  if (
    normalizedPattern.includes('**/draft-') &&
    normalizedPattern.endsWith('.md')
  ) {
    return /(^|\/)draft-[^/]+\.md$/i.test(sourcePath);
  }

  return false;
}

async function collectMarkdownPaths(workspaceRoot, config) {
  const collected = new Set();

  for (const includePattern of config.include ?? []) {
    if (includePattern === 'README.md') {
      const readmePath = path.join(workspaceRoot, 'README.md');
      if (await pathExists(readmePath)) {
        collected.add('README.md');
      }
      continue;
    }

    if (includePattern.endsWith('/**/*.md')) {
      const rootDir = includePattern.slice(0, -'/**/*.md'.length);
      for (const filePath of await collectRecursiveMarkdownPaths(
        workspaceRoot,
        rootDir
      )) {
        collected.add(filePath);
      }
    }
  }

  for (const projectReadme of config.projectReadmes ?? []) {
    const absolutePath = path.join(workspaceRoot, projectReadme);
    if (await pathExists(absolutePath)) {
      collected.add(projectReadme.replace(/\\/g, '/'));
    }
  }

  return [...collected]
    .filter(
      (sourcePath) =>
        !(config.exclude ?? []).some((pattern) =>
          matchesExcludePattern(sourcePath, pattern)
        )
    )
    .sort((left, right) => left.localeCompare(right));
}

export async function buildDocsManifest({
  workspaceRoot,
  configPath = path.join(workspaceRoot, DEFAULT_CONFIG_PATH),
  outputPath = path.join(workspaceRoot, DEFAULT_OUTPUT_PATH),
} = {}) {
  const root = workspaceRoot ?? process.cwd();
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const markdownPaths = await collectMarkdownPaths(root, config);
  const previousManifest = await readPreviousManifest(outputPath);
  const previousItemsBySourcePath = new Map(
    (previousManifest?.items ?? []).map((item) => [item.sourcePath, item])
  );

  const items = [];

  for (const sourcePath of markdownPaths) {
    const absolutePath = path.join(root, sourcePath);
    const stats = await fs.stat(absolutePath);
    const rawMarkdown = await fs.readFile(absolutePath, 'utf8');
    const { data, body } = extractFrontmatter(rawMarkdown);
    const headings = extractHeadings(body);
    const slug = sourcePathToSlug(sourcePath);
    const title =
      data.title ?? headings[0]?.text ?? humanizeSlug(path.basename(slug));
    const summary = data.summary ?? extractSummary(body);
    const category =
      data.category ??
      (sourcePath.startsWith('docs/')
        ? sourcePath.split('/')[1]?.replace(/\.md$/i, '') || 'reference'
        : sourcePath.split('/')[0] || 'reference');

    const item = {
      slug,
      title,
      summary,
      sourcePath,
      category,
      audience: typeof data.audience === 'string' ? data.audience : undefined,
      section: typeof data.section === 'string' ? data.section : undefined,
      parent: typeof data.parent === 'string' ? data.parent : undefined,
      tags: Array.isArray(data.tags) ? data.tags : [],
      kind: data.docType === 'deck' ? 'deck' : 'doc',
      headings,
      body,
      order: Number.isFinite(data.order) ? data.order : 999,
      landing: data.landing === true,
      docRole:
        data.docRole === 'landing' ||
        data.docRole === 'guide' ||
        data.docRole === 'runbook' ||
        data.docRole === 'reference'
          ? data.docRole
          : undefined,
      featured: data.featured === true,
      relatedPackages: Array.isArray(data.relatedPackages)
        ? data.relatedPackages.filter((value) => typeof value === 'string')
        : undefined,
      lastUpdated: stats.mtime.toISOString(),
    };
    const previousItem = previousItemsBySourcePath.get(sourcePath);
    if (previousItem && itemContentMatches(item, previousItem)) {
      item.lastUpdated = previousItem.lastUpdated;
    }

    items.push(item);
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    items,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildDocsManifest({ workspaceRoot: process.cwd() }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
