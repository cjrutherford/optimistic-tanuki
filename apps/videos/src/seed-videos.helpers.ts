import { Dirent, promises as fs } from 'fs';
import { basename, extname, join, relative } from 'path';

const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mpeg', '.mov', '.webm', '.mkv', '.avi', '.m3u8']);

export async function discoverSeedVideoFiles(
  rootDir: string,
  options: { maxFiles?: number } = {},
): Promise<string[]> {
  const results: string[] = [];
  const maxFiles =
    options.maxFiles === undefined ? undefined : Math.max(0, options.maxFiles);

  async function walk(currentDir: string): Promise<void> {
    if (maxFiles !== undefined && results.length >= maxFiles) {
      return;
    }

    const entries = await fs.readdir(currentDir, {
      withFileTypes: true,
    });

    const sortedEntries = entries.sort(sortDirents);

    for (const entry of sortedEntries) {
      if (maxFiles !== undefined && results.length >= maxFiles) {
        return;
      }

      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        SUPPORTED_VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())
      ) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function sortDirents(left: Dirent, right: Dirent): number {
  if (left.isDirectory() !== right.isDirectory()) {
    return left.isDirectory() ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

export function deriveVideoTitle(filePath: string): string {
  return basename(filePath, extname(filePath))
    .replace(/[._]+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRelativeImportPath(
  rootDir: string,
  filePath: string,
): string {
  return relative(rootDir, filePath);
}

export function deriveChannelName(rootDir: string, filePath: string): string {
  const relativePath = getRelativeImportPath(rootDir, filePath);
  const [topLevelSegment] = relativePath.split(/[\\/]/);

  if (!topLevelSegment || topLevelSegment === basename(filePath)) {
    return 'Imported TV';
  }

  return topLevelSegment.trim() || 'Imported TV';
}

export function assessVideoImport(
  filePath: string,
  fileSizeBytes: number,
): { canImport: true } | { canImport: false; reason: string } {
  const extension = extname(filePath).toLowerCase();

  if (!SUPPORTED_VIDEO_EXTENSIONS.has(extension)) {
    return {
      canImport: false,
      reason: `unsupported extension ${extension}; supported extensions: ${Array.from(
        SUPPORTED_VIDEO_EXTENSIONS,
      ).join(', ')}`,
    };
  }

  return { canImport: true };
}
