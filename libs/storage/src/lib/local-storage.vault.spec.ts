import {
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AssetType } from '@optimistic-tanuki/models';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';

import {
  EnvelopeEncryptionService,
  VAULT_STORAGE_KEK_ENV,
} from './envelope-encryption.service';
import {
  STANDARD_DIR_MODE,
  STANDARD_FILE_MODE,
  TAX_DOCUMENT_DIR_MODE,
  TAX_DOCUMENT_FILE_MODE,
  LocalStorageAdapter,
} from './local-storage';
import { ZfsCommandRunner, ZfsStorageService } from './zfs-storage.service';

// jest.requireActual hands back the real module object without registering a
// mock, so the adapter under test keeps using the real filesystem.
const mockFs: typeof import('fs/promises') = jest.requireActual('fs/promises');
const realRename = mockFs.rename.bind(mockFs);
let renameSpy: jest.SpyInstance;
let fileHandlePrototype: { sync: (callback?: () => void) => Promise<void> };

let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `uuid-${++uuidCounter}`),
}));

const FORM_1040 = 'Form 1040 (2025)\nU.S. Individual Income Tax Return';
const W2 = 'Form W-2 Wage and Tax Statement 2025';
const FORM_1099 = 'Form 1099-NEC Nonemployee Compensation 2025';

const noCommands: ZfsCommandRunner = () =>
  Promise.reject(new Error('zfs: command not found'));

describe('LocalStorageAdapter vault hardening', () => {
  let basePath: string;
  let logger: Logger;
  let encryption: EnvelopeEncryptionService;
  let zfsRuns: string[];

  const zfsRunner = (
    handlers: Partial<Record<string, string>>
  ): ZfsCommandRunner => {
    return (command) => {
      zfsRuns.push(command);
      const value = handlers[command];
      return value === undefined
        ? Promise.reject(new Error(`${command}: not found`))
        : Promise.resolve(value);
    };
  };

  const buildAdapter = (
    zfs: ZfsStorageService = new ZfsStorageService(noCommands, {})
  ): LocalStorageAdapter =>
    new LocalStorageAdapter(logger, basePath, encryption, undefined, zfs);

  const mode = (target: string): string =>
    (statSync(target).mode & 0o777).toString(8);

  beforeEach(() => {
    uuidCounter = 0;
    zfsRuns = [];
    basePath = mkdtempSync(path.join(tmpdir(), 'vault-storage-'));
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;
    encryption = new EnvelopeEncryptionService({
      [VAULT_STORAGE_KEK_ENV]: 'vault-hardening-spec-kek',
    });
  });

  beforeAll(async () => {
    const probe = path.join(tmpdir(), `vault-sync-probe-${process.pid}`);
    const handle = await mockFs.open(probe, 'w');
    fileHandlePrototype = Object.getPrototypeOf(handle) as {
      sync: (callback?: () => void) => Promise<void>;
    };
    await handle.close();
    rmSync(probe, { force: true });
  });

  beforeEach(() => {
    renameSpy = jest.spyOn(mockFs, 'rename');
  });

  afterEach(() => {
    renameSpy.mockRestore();
    rmSync(basePath, { recursive: true, force: true });
  });

  describe('atomic writes', () => {
    it('fsyncs the temp file and publishes it with a same-directory rename', async () => {
      const syncSpy = jest.spyOn(fileHandlePrototype, 'sync');
      const observations: Array<{
        tempPath: string;
        tempName: string;
        tempSize: number;
        destination: string;
        destinationExisted: boolean;
        sameDirectory: boolean;
      }> = [];
      renameSpy.mockImplementation(async (from: string, to: string) => {
        observations.push({
          tempPath: from,
          tempName: path.basename(from),
          tempSize: statSync(from).size,
          destination: to,
          destinationExisted: existsSync(to),
          sameDirectory: path.dirname(from) === path.dirname(to),
        });
        return realRename(from, to);
      });
      const adapter = buildAdapter();

      const created = await adapter.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);

      const destination = path.join(basePath, created.storagePath);
      expect(renameSpy).toHaveBeenCalledTimes(1);
      expect(observations).toHaveLength(1);
      expect(observations[0].sameDirectory).toBe(true);
      expect(observations[0].tempName).toMatch(
        /^\.1040\.pdf\.[0-9a-f]{16}\.tmp$/
      );
      expect(observations[0].destination).toBe(destination);
      // The destination only appears through the rename: it is never
      // truncated or partially written in place.
      expect(observations[0].destinationExisted).toBe(false);
      expect(observations[0].tempSize).toBeGreaterThan(0);
      expect(syncSpy).toHaveBeenCalled();
      expect(statSync(destination).size).toBe(observations[0].tempSize);
      syncSpy.mockRestore();
    });

    it('leaves no temporary file behind after a successful write', async () => {
      const adapter = buildAdapter();

      const created = await adapter.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);

      const directory = path.join(basePath, path.dirname(created.storagePath));
      expect(readdirSync(directory)).toEqual(['1040.pdf']);
    });

    it('leaves no temporary file behind when the classification rejects the write', async () => {
      const adapter = buildAdapter();

      await expect(
        adapter.create({
          name: '1040.jpg',
          profileId: 'p',
          type: AssetType.IMAGE,
          content: Buffer.from(FORM_1040),
        } as never)
      ).rejects.toThrow(UnprocessableEntityException);

      const assetRoot = path.join(basePath, 'assets');
      expect(existsSync(assetRoot) ? readdirSync(assetRoot) : []).toEqual([]);
    });

    it('removes the temp file and publishes nothing when the rename fails', async () => {
      renameSpy.mockRejectedValueOnce(new Error('EXDEV: cross-device link'));
      const adapter = buildAdapter();

      await expect(
        adapter.create({
          name: 'w-2.pdf',
          profileId: 'p',
          type: AssetType.DOCUMENT,
          content: Buffer.from(W2),
        } as never)
      ).rejects.toThrow('cross-device link');

      const assetRoot = path.join(basePath, 'assets');
      const leftovers = existsSync(assetRoot)
        ? readdirSync(assetRoot).flatMap((assetDir) =>
            readdirSync(path.join(assetRoot, assetDir))
          )
        : [];
      expect(leftovers).toEqual([]);
    });
  });

  describe('file permissions', () => {
    it.each([
      ['1040.pdf', FORM_1040],
      ['w-2.pdf', W2],
      ['1099-nec.pdf', FORM_1099],
    ])('keeps %s owner-only', async (name, body) => {
      const adapter = buildAdapter();

      const created = await adapter.create({
        name,
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(body),
      } as never);

      const file = path.join(basePath, created.storagePath);
      expect(mode(file)).toBe((TAX_DOCUMENT_FILE_MODE & 0o777).toString(8));
      expect(statSync(file).mode & 0o007).toBe(0);
      expect(statSync(file).mode & 0o070).toBe(0);
      expect(mode(path.dirname(file))).toBe(
        (TAX_DOCUMENT_DIR_MODE & 0o777).toString(8)
      );
    });

    it('keeps a non tax document out of the owner-only tax mode', async () => {
      const adapter = buildAdapter();

      const created = await adapter.create({
        name: 'retainer.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from('Retainer agreement for representation.'),
      } as never);

      const file = path.join(basePath, created.storagePath);
      expect(mode(file)).toBe((STANDARD_FILE_MODE & 0o777).toString(8));
      expect(statSync(file).mode & 0o007).toBe(0);
      expect(mode(path.dirname(file))).toBe(
        (STANDARD_DIR_MODE & 0o777).toString(8)
      );
    });

    it('is tighter than the platform default for every stored object', async () => {
      const adapter = buildAdapter();

      const created = await adapter.create({
        name: 'client-photo.png',
        profileId: 'p',
        type: AssetType.IMAGE,
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      } as never);

      const file = path.join(basePath, created.storagePath);
      expect(statSync(file).mode & 0o022).toBe(0);
    });
  });

  describe('tax classification on the write path', () => {
    it.each([
      ['1040.pdf', FORM_1040, 'FORM_1040'],
      ['scan-0007.pdf', W2, 'FORM_W2'],
      ['scan-0008.pdf', FORM_1099, 'FORM_1099'],
    ])(
      'routes %s to %s and seals it into the envelope',
      async (name, body, formType) => {
        const adapter = buildAdapter();

        const created = await adapter.create({
          name,
          profileId: 'p',
          type: AssetType.DOCUMENT,
          content: Buffer.from(body),
        } as never);

        const stored = await fs.readFile(
          path.join(basePath, created.storagePath)
        );
        expect(encryption.readAssociatedData(stored)).toBe(
          JSON.stringify({
            formType,
            handling: 'TAX_STRICT',
            originalName: name,
          })
        );
      }
    );

    it('rejects a tax form smuggled through a media type', async () => {
      const adapter = buildAdapter();

      await expect(
        adapter.create({
          name: '1040.png',
          profileId: 'p',
          type: AssetType.IMAGE,
          content: Buffer.from(FORM_1040),
        } as never)
      ).rejects.toThrow(/contradicts a FORM_1040 content signature/);
    });

    it('does not let a .txt file skip tax handling', async () => {
      const adapter = buildAdapter();

      const created = await adapter.create({
        name: '1040.txt',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);

      const file = path.join(basePath, created.storagePath);
      expect(mode(file)).toBe((TAX_DOCUMENT_FILE_MODE & 0o777).toString(8));
      expect(encryption.readAssociatedData(await fs.readFile(file))).toContain(
        'TAX_STRICT'
      );
    });
  });

  describe('zfs reporting', () => {
    it('reports the real filesystem and claims no dataset when zfs is absent', async () => {
      const adapter = buildAdapter(
        new ZfsStorageService(zfsRunner({ stat: 'ext4\n' }), {})
      );

      const report = await adapter.getZfsReport();

      expect(report.isZfs).toBe(false);
      expect(report.filesystemType).toBe('ext4');
      expect(report.dataset).toBeNull();
      expect(report.snapshotCapable).toBe(false);
      expect(report.snapshotsTaken).toBe(0);
      expect(report.detail).toMatch(/ZFS is not in use/);
      expect(zfsRuns).toContain('zfs');
    });

    it('records the dataset and pool when the target really is a zfs dataset', async () => {
      const adapter = buildAdapter(
        new ZfsStorageService(
          zfsRunner({
            zfs: 'tank\t/\ntank/vault\t/srv/vault\n',
            stat: 'zfs\n',
          }),
          {}
        )
      );

      const report = await adapter.getZfsReport();

      expect(report.isZfs).toBe(true);
      expect(report.dataset).toBe('tank');
      expect(report.pool).toBe('tank');
      expect(report.snapshotCapable).toBe(true);
      expect(report.snapshotsTaken).toBe(0);
      expect(report.detail).toMatch(/No snapshot was created by this write/);
    });

    it('probes the target once and reuses the memoized report', async () => {
      const adapter = buildAdapter(
        new ZfsStorageService(zfsRunner({ stat: 'ext4\n' }), {})
      );

      await adapter.create({
        name: 'a.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from('one'),
      } as never);
      const probesAfterFirstWrite = zfsRuns.length;
      await adapter.create({
        name: 'b.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from('two'),
      } as never);

      expect(zfsRuns).toHaveLength(probesAfterFirstWrite);
    });

    it('fails closed when VAULT_STORAGE_ZFS_REQUIRED is set and zfs is absent', async () => {
      const adapter = buildAdapter(
        new ZfsStorageService(zfsRunner({ stat: 'ext4\n' }), {
          VAULT_STORAGE_ZFS_REQUIRED: '1',
        })
      );

      await expect(
        adapter.create({
          name: '1040.pdf',
          profileId: 'p',
          type: AssetType.DOCUMENT,
          content: Buffer.from(FORM_1040),
        } as never)
      ).rejects.toThrow(ServiceUnavailableException);
      await expect(
        adapter.create({
          name: '1040.pdf',
          profileId: 'p',
          type: AssetType.DOCUMENT,
          content: Buffer.from(FORM_1040),
        } as never)
      ).rejects.toThrow(/VAULT_STORAGE_ZFS_REQUIRED/);
    });

    it('writes when VAULT_STORAGE_ZFS_REQUIRED is set and zfs is present', async () => {
      const adapter = buildAdapter(
        new ZfsStorageService(zfsRunner({ zfs: 'tank\t/\n', stat: 'zfs\n' }), {
          VAULT_STORAGE_ZFS_REQUIRED: '1',
        })
      );

      const created = await adapter.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);

      expect(existsSync(path.join(basePath, created.storagePath))).toBe(true);
    });

    it('never takes a snapshot on any path', async () => {
      const adapter = buildAdapter(
        new ZfsStorageService(
          zfsRunner({ zfs: 'tank\t/\n', stat: 'zfs\n' }),
          {}
        )
      );

      await adapter.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);

      expect(zfsRuns.every((command) => !command.includes('snapshot'))).toBe(
        true
      );
      expect((await adapter.getZfsReport()).snapshotsTaken).toBe(0);
    });
  });

  describe('key configuration', () => {
    it('fails closed on write when the key encryption key is absent', async () => {
      const adapter = new LocalStorageAdapter(
        logger,
        basePath,
        new EnvelopeEncryptionService({}),
        undefined,
        new ZfsStorageService(noCommands, {})
      );

      await expect(
        adapter.create({
          name: '1040.pdf',
          profileId: 'p',
          type: AssetType.DOCUMENT,
          content: Buffer.from(FORM_1040),
        } as never)
      ).rejects.toThrow(
        `${VAULT_STORAGE_KEK_ENV} is required for vault storage envelope encryption.`
      );
    });

    it('fails closed on read when the key encryption key is absent', async () => {
      const writer = buildAdapter();
      const created = await writer.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);

      const reader = new LocalStorageAdapter(
        logger,
        basePath,
        new EnvelopeEncryptionService({}),
        undefined,
        new ZfsStorageService(noCommands, {})
      );

      await expect(reader.read(created)).rejects.toThrow(
        ServiceUnavailableException
      );
    });
  });

  describe('read path', () => {
    it('returns the plaintext through the adapter', async () => {
      const adapter = buildAdapter();
      const created = await adapter.create({
        name: 'w-2.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(W2),
      } as never);

      const result = await adapter.read(created);

      expect(result).toBe(
        `data:application/pdf;base64,${Buffer.from(W2).toString('base64')}`
      );
    });

    it('fails closed when the stored bytes are not an envelope', async () => {
      const adapter = buildAdapter();
      const created = await adapter.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);
      writeFileSync(path.join(basePath, created.storagePath), 'plaintext');

      await expect(adapter.read(created)).rejects.toThrow(
        'refusing to return unauthenticated content'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('fails closed when a stored envelope has been tampered with', async () => {
      const adapter = buildAdapter();
      const created = await adapter.create({
        name: '1040.pdf',
        profileId: 'p',
        type: AssetType.DOCUMENT,
        content: Buffer.from(FORM_1040),
      } as never);
      const target = path.join(basePath, created.storagePath);
      const stored = await fs.readFile(target);
      stored[stored.length - 1] ^= 0xff;
      writeFileSync(target, stored);

      await expect(adapter.read(created)).rejects.toThrow(
        'failed AES-256-GCM authentication'
      );
    });
  });
});
