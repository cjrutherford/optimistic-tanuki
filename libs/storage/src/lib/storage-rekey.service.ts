import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import * as path from 'node:path';
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import type { S3Service } from './s3.service';

export type RekeyFileStatus =
  | 'already-encrypted'
  | 're-encrypted'
  | 'skipped-unreadable'
  | 'failed-verification'
  | 'dry-run-would-encrypt';

export interface RekeyManifestEntry {
  location: string;
  bytes: number | null;
  status: RekeyFileStatus;
  error?: string;
}

export interface RekeyReport {
  entries: RekeyManifestEntry[];
  scanned: number;
  encrypted: number;
  failed: number;
}

export interface RekeyOptions {
  dryRun?: boolean;
  backupDir?: string;
}

export class StorageRekeyService {
  constructor(
    private readonly encryption: EnvelopeEncryptionService = new EnvelopeEncryptionService()
  ) {}

  async planLocalDirectory(basePath: string): Promise<RekeyReport> {
    return this.rekeyLocalDirectory(basePath, { dryRun: true });
  }

  async rekeyLocalDirectory(
    basePath: string,
    options: RekeyOptions = {}
  ): Promise<RekeyReport> {
    const report: RekeyReport = {
      entries: [],
      scanned: 0,
      encrypted: 0,
      failed: 0,
    };
    const files = await this.walkFiles(basePath);
    for (const file of files) {
      report.scanned += 1;
      const entry = await this.rekeyLocalFile(basePath, file, options);
      report.entries.push(entry);
      if (entry.status === 're-encrypted') {
        report.encrypted += 1;
      } else if (
        entry.status === 'failed-verification' ||
        entry.status === 'skipped-unreadable'
      ) {
        report.failed += 1;
      }
    }
    return report;
  }

  async rekeyS3Keys(
    s3: Pick<S3Service, 'getObject' | 'uploadObject'>,
    keys: string[],
    options: RekeyOptions = {}
  ): Promise<RekeyReport> {
    const report: RekeyReport = {
      entries: [],
      scanned: 0,
      encrypted: 0,
      failed: 0,
    };
    for (const key of keys) {
      report.scanned += 1;
      const entry = await this.rekeyS3Key(s3, key, options);
      report.entries.push(entry);
      if (entry.status === 're-encrypted') {
        report.encrypted += 1;
      } else if (
        entry.status === 'failed-verification' ||
        entry.status === 'skipped-unreadable'
      ) {
        report.failed += 1;
      }
    }
    return report;
  }

  private async walkFiles(basePath: string): Promise<string[]> {
    const found: string[] = [];
    const visit = async (dir: string): Promise<void> => {
      const names = await readdir(dir, { withFileTypes: true });
      for (const name of names) {
        const full = path.join(dir, name.name);
        if (name.isDirectory()) {
          await visit(full);
        } else if (name.isFile()) {
          found.push(path.relative(basePath, full));
        }
      }
    };
    await visit(basePath);
    return found.sort();
  }

  private async rekeyLocalFile(
    basePath: string,
    relativePath: string,
    options: RekeyOptions
  ): Promise<RekeyManifestEntry> {
    const absolutePath = path.join(basePath, relativePath);
    let stored: Buffer;
    try {
      stored = await readFile(absolutePath);
    } catch (error) {
      return {
        location: relativePath,
        bytes: null,
        status: 'skipped-unreadable',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (this.encryption.isEnvelope(stored)) {
      return {
        location: relativePath,
        bytes: stored.length,
        status: 'already-encrypted',
      };
    }
    if (options.dryRun) {
      return {
        location: relativePath,
        bytes: stored.length,
        status: 'dry-run-would-encrypt',
      };
    }
    return this.replaceWithEnvelope(relativePath, stored, async (container) => {
      if (options.backupDir) {
        const backupPath = path.join(options.backupDir, `${relativePath}.bak`);
        await mkdir(path.dirname(backupPath), { recursive: true });
        await copyFile(absolutePath, backupPath);
      }
      const tempPath = `${absolutePath}.rekey-${process.pid}.tmp`;
      await writeFile(tempPath, container, { mode: 0o600 });
      await rename(tempPath, absolutePath);
    });
  }

  private async rekeyS3Key(
    s3: Pick<S3Service, 'getObject' | 'uploadObject'>,
    key: string,
    options: RekeyOptions
  ): Promise<RekeyManifestEntry> {
    let stored: Buffer;
    try {
      stored = await s3.getObject(key);
    } catch (error) {
      return {
        location: key,
        bytes: null,
        status: 'skipped-unreadable',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (this.encryption.isEnvelope(stored)) {
      return {
        location: key,
        bytes: stored.length,
        status: 'already-encrypted',
      };
    }
    if (options.dryRun) {
      return {
        location: key,
        bytes: stored.length,
        status: 'dry-run-would-encrypt',
      };
    }
    return this.replaceWithEnvelope(key, stored, async (container) => {
      await s3.uploadObject(key, container, 'application/octet-stream');
    });
  }

  private async replaceWithEnvelope(
    location: string,
    plaintext: Buffer,
    replace: (container: Buffer) => Promise<void>
  ): Promise<RekeyManifestEntry> {
    let container: Buffer;
    try {
      container = this.encryption.encrypt(plaintext);
    } catch (error) {
      return {
        location,
        bytes: plaintext.length,
        status: 'failed-verification',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    let roundTripped: Buffer;
    try {
      roundTripped = this.encryption.decrypt(container);
    } catch (error) {
      return {
        location,
        bytes: plaintext.length,
        status: 'failed-verification',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (!roundTripped.equals(plaintext)) {
      return {
        location,
        bytes: plaintext.length,
        status: 'failed-verification',
        error: 'Encrypt/decrypt round-trip mismatch; original left untouched.',
      };
    }
    try {
      await replace(container);
    } catch (error) {
      return {
        location,
        bytes: plaintext.length,
        status: 'failed-verification',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    return { location, bytes: plaintext.length, status: 're-encrypted' };
  }
}
