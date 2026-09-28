import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import * as path from 'path';

export type ZfsDetectionMethod = 'zfs-list' | 'stat' | 'df' | 'unavailable';

export interface ZfsDataset {
  name: string;
  mountPoint: string;
}

export interface ZfsStorageReport {
  targetPath: string;
  isZfs: boolean;
  filesystemType: string | null;
  dataset: string | null;
  pool: string | null;
  mountPoint: string | null;
  snapshotCapable: boolean;
  snapshotsTaken: number;
  detection: ZfsDetectionMethod;
  datasetEnumerationFailed: boolean;
  detail: string;
}

export type ZfsCommandRunner = (
  command: string,
  args: string[]
) => Promise<string>;

export const ZFS_COMMAND_TIMEOUT_MS = 2000;
export const ZFS_COMMAND_MAX_BUFFER = 1024 * 1024;

export const runZfsCommand: ZfsCommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: ZFS_COMMAND_TIMEOUT_MS,
        maxBuffer: ZFS_COMMAND_MAX_BUFFER,
        encoding: 'utf8',
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );
  });

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  const code = (error as { code?: string } | null)?.code;
  return code ? `${String(error)} (${code})` : String(error);
}

@Injectable()
export class ZfsStorageService {
  private readonly logger = new Logger(ZfsStorageService.name);

  constructor(
    private readonly runCommand: ZfsCommandRunner = runZfsCommand,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async detect(targetPath: string): Promise<ZfsStorageReport> {
    const resolved = path.resolve(targetPath);
    const datasets = await this.listDatasets();
    const match = datasets
      ? this.findEnclosingDataset(datasets, resolved)
      : null;
    const filesystemType = await this.filesystemType(resolved);

    const isZfs = match !== null || filesystemType === 'zfs';
    const snapshotCapable = isZfs && match !== null;

    return {
      targetPath: resolved,
      isZfs,
      filesystemType,
      dataset: match?.name ?? null,
      pool: match ? match.name.split('/')[0] ?? null : null,
      mountPoint: match?.mountPoint ?? null,
      snapshotCapable,
      snapshotsTaken: 0,
      detection: match ? 'zfs-list' : filesystemType ? 'stat' : 'unavailable',
      datasetEnumerationFailed: datasets === null,
      detail: this.describe(
        isZfs,
        filesystemType,
        match,
        datasets === null,
        resolved
      ),
    };
  }

  isZfsRequired(): boolean {
    const value = this.env['VAULT_STORAGE_ZFS_REQUIRED'];
    return value === '1' || value?.toLowerCase() === 'true';
  }

  private describe(
    isZfs: boolean,
    filesystemType: string | null,
    match: ZfsDataset | null,
    enumerationFailed: boolean,
    resolved: string
  ): string {
    if (isZfs && match) {
      return `ZFS dataset ${match.name} is mounted at ${match.mountPoint}; snapshot-capable writes are recorded against dataset ${match.name}. No snapshot was created by this write.`;
    }
    if (isZfs) {
      return `Filesystem for ${resolved} reports type zfs, but no ZFS dataset mountpoint encloses it${
        enumerationFailed ? ' (the zfs list enumeration failed)' : ''
      }. No dataset or snapshot is claimed.`;
    }
    return `ZFS is not in use for ${resolved}: filesystem type is ${
      filesystemType ?? 'unknown'
    }${
      enumerationFailed ? ' and the zfs list enumeration failed' : ''
    }. No dataset and no snapshot are claimed; the real filesystem is reported instead.`;
  }

  private async listDatasets(): Promise<ZfsDataset[] | null> {
    try {
      const stdout = await this.runCommand('zfs', [
        'list',
        '-H',
        '-o',
        'name,mountpoint',
      ]);
      const datasets: ZfsDataset[] = [];
      for (const line of stdout.split('\n')) {
        const [name, mountPoint] = line.split('\t');
        if (name && mountPoint) {
          datasets.push({ name, mountPoint });
        }
      }
      return datasets;
    } catch (error) {
      this.logger.debug(
        `ZFS dataset enumeration unavailable: ${describeError(error)}`
      );
      return null;
    }
  }

  private findEnclosingDataset(
    datasets: ZfsDataset[],
    targetPath: string
  ): ZfsDataset | null {
    let best: ZfsDataset | null = null;
    for (const dataset of datasets) {
      const mountPoint = path.resolve(dataset.mountPoint);
      if (!this.encloses(mountPoint, targetPath)) {
        continue;
      }
      if (
        best === null ||
        mountPoint.length > path.resolve(best.mountPoint).length
      ) {
        best = dataset;
      }
    }
    return best;
  }

  private encloses(mountPoint: string, targetPath: string): boolean {
    if (mountPoint === '/') {
      return true;
    }
    const relative = path.relative(mountPoint, targetPath);
    return (
      relative.length > 0 &&
      !relative.startsWith('..') &&
      !path.isAbsolute(relative)
    );
  }

  private async filesystemType(targetPath: string): Promise<string | null> {
    const fromStat = await this.statFilesystemType(targetPath);
    if (fromStat) {
      return fromStat;
    }
    return this.dfFilesystemType(targetPath);
  }

  private async statFilesystemType(targetPath: string): Promise<string | null> {
    try {
      const stdout = await this.runCommand('stat', [
        '-f',
        '-c',
        '%T',
        targetPath,
      ]);
      const value = stdout.trim().toLowerCase();
      return value.length > 0 ? value : null;
    } catch (error) {
      this.logger.debug(
        `stat filesystem probe failed: ${describeError(error)}`
      );
      return null;
    }
  }

  private async dfFilesystemType(targetPath: string): Promise<string | null> {
    try {
      const stdout = await this.runCommand('df', ['-PT', targetPath]);
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) {
        return null;
      }
      const columns = lines[lines.length - 1].trim().split(/\s+/);
      const type = columns[1]?.toLowerCase();
      return type && type.length > 0 ? type : null;
    } catch (error) {
      this.logger.debug(`df filesystem probe failed: ${describeError(error)}`);
      return null;
    }
  }
}
