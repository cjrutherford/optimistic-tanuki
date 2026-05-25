import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_CONFIG_PATH = 'tools/docs-site/compodoc-libraries.json';
const DEFAULT_OUTPUT_PATH =
  'apps/ui-playground/public/generated/compodoc-index.json';
const DEFAULT_OUTPUT_ROOT = 'apps/ui-playground/public/generated/compodoc';
const DEFAULT_PUBLIC_OUTPUT_ROOT =
  'apps/ui-playground/public/generated/compodoc';

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function getLatestModifiedTime(filePath) {
  const stats = await statSafe(filePath);
  if (!stats) {
    return 0;
  }

  if (stats.isFile()) {
    return stats.mtimeMs;
  }

  if (!stats.isDirectory()) {
    return 0;
  }

  const entries = await fs.readdir(filePath, { withFileTypes: true });
  let latest = stats.mtimeMs;

  for (const entry of entries) {
    latest = Math.max(
      latest,
      await getLatestModifiedTime(path.join(filePath, entry.name))
    );
  }

  return latest;
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

async function resolvePackageAvailable(workspaceRoot) {
  return pathExists(
    path.join(workspaceRoot, 'node_modules/@compodoc/compodoc/package.json')
  );
}

function runCompodoc(workspaceRoot, library, outputDir) {
  const result = spawnSync(
    pnpmCommand(),
    [
      'exec',
      'compodoc',
      '-p',
      library.tsconfigPath,
      '-d',
      outputDir,
      '-n',
      library.name,
      '--silent',
      '--minimal',
      '--disableGraph',
    ],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
    }
  );

  if (result.status !== 0) {
    throw new Error(`Compodoc generation failed for ${library.slug}`);
  }
}

async function shouldGenerateCompodoc(workspaceRoot, library, outputDir) {
  const indexHtmlPath = path.join(outputDir, 'index.html');
  const indexStats = await statSafe(indexHtmlPath);

  if (!indexStats?.isFile()) {
    return true;
  }

  const latestSourceTime = Math.max(
    await getLatestModifiedTime(path.join(workspaceRoot, library.tsconfigPath)),
    await getLatestModifiedTime(path.join(workspaceRoot, library.readmePath)),
    await getLatestModifiedTime(path.join(workspaceRoot, library.sourceRoot))
  );

  return latestSourceTime > indexStats.mtimeMs;
}

export async function buildCompodocIndex({
  workspaceRoot = process.cwd(),
  configPath = path.join(workspaceRoot, DEFAULT_CONFIG_PATH),
  outputPath = path.join(workspaceRoot, DEFAULT_OUTPUT_PATH),
  outputRoot = path.join(workspaceRoot, DEFAULT_OUTPUT_ROOT),
  publicOutputRoot = DEFAULT_PUBLIC_OUTPUT_ROOT,
  compodocAvailable = undefined,
  runCompodocFn = runCompodoc,
} = {}) {
  const libraries = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const packageAvailable =
    compodocAvailable ?? (await resolvePackageAvailable(workspaceRoot));

  await fs.mkdir(outputRoot, { recursive: true });

  const items = [];

  for (const library of libraries) {
    const relativeOutputDir = path.posix.join(publicOutputRoot, library.slug);
    const absoluteOutputDir = path.join(outputRoot, library.slug);

    if (
      packageAvailable &&
      (await shouldGenerateCompodoc(workspaceRoot, library, absoluteOutputDir))
    ) {
      await fs.mkdir(absoluteOutputDir, { recursive: true });
      await runCompodocFn(workspaceRoot, library, absoluteOutputDir);
    }

    const indexHtmlPath = path.join(absoluteOutputDir, 'index.html');
    const available = await pathExists(indexHtmlPath);

    items.push({
      ...library,
      outputPath: relativeOutputDir,
      url: `/generated/compodoc/${library.slug}/index.html`,
      available,
      generatedAt: new Date().toISOString(),
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    items,
  };

  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildCompodocIndex().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
