import { Logger, NotImplementedException } from '@nestjs/common';
import {
  AssetDto,
  AssetType,
  StorageStrategy,
} from '@optimistic-tanuki/models';
import {
  existsSync,
  linkSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { LocalStorageAdapter } from './local-storage';
import {
  EnvelopeEncryptionService,
  VAULT_STORAGE_KEK_ENV,
} from './envelope-encryption.service';
import { ZfsStorageService } from './zfs-storage.service';

// uuid ships as ESM, which this project's jest transform does not parse, so it
// has to be stubbed. Ids still increment so two assets remain distinguishable.
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `uuid-${++uuidCounter}`),
}));

process.env[VAULT_STORAGE_KEK_ENV] = 'local-storage-spec-kek';

/**
 * These run against a real temp directory rather than a mocked fs: the adapter
 * is mostly path construction and file IO, and mocking that away would leave
 * nothing worth asserting.
 */
describe('LocalStorageAdapter', () => {
  let basePath: string;
  let logger: Logger;
  let adapter: LocalStorageAdapter;

  const asset = (overrides: Partial<AssetDto> = {}): AssetDto =>
    ({
      id: 'asset-1',
      name: 'file.png',
      storagePath: 'assets/asset-1/file.png',
      type: AssetType.IMAGE,
      storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
      profileId: 'profile-1',
      ...overrides,
    } as AssetDto);

  beforeEach(() => {
    basePath = mkdtempSync(path.join(tmpdir(), 'local-storage-'));
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;
    adapter = new LocalStorageAdapter(
      logger,
      basePath,
      new EnvelopeEncryptionService(),
      undefined,
      new ZfsStorageService(
        () => Promise.reject(new Error('zfs: not found')),
        {}
      )
    );
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  describe('construction', () => {
    it('creates the base path when it does not exist yet', () => {
      const missing = path.join(basePath, 'nested', 'deeper');

      new LocalStorageAdapter(logger, missing, new EnvelopeEncryptionService());

      expect(existsSync(missing)).toBe(true);
    });
  });

  describe('create', () => {
    it('rejects a traversal filename before reserving bytes', () => {
      expect(() =>
        adapter.reservationPath({
          id: '11111111-1111-4111-8111-111111111111',
          name: '../sentinel',
        } as never)
      ).toThrow('Asset filename is invalid');
    });
    it('uses a caller-reserved id so lifecycle cleanup can find the same bytes', async () => {
      const created = await adapter.create({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'photo.png',
        profileId: 'profile-1',
        type: AssetType.IMAGE,
        content: Buffer.from('lifecycle'),
      } as never);
      expect(created.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(created.storagePath).toBe(
        path.join('assets', '11111111-1111-4111-8111-111111111111', 'photo.png')
      );
    });

    it('writes a data-url payload and returns a relative storage path', async () => {
      const created = await adapter.create({
        name: 'photo.png',
        profileId: 'profile-1',
        type: AssetType.IMAGE,
        content: `data:image/png;base64,${Buffer.from('hello').toString(
          'base64'
        )}`,
      } as never);

      expect(created.storagePath).toBe(
        path.join('assets', created.id, 'photo.png')
      );
      // The stored path is relative; the base path is not baked into it.
      expect(created.storagePath).not.toContain(basePath);
      expect(created.storageStrategy).toBe(StorageStrategy.LOCAL_BLOCK_STORAGE);

      const written = await fs.readFile(
        path.join(basePath, created.storagePath)
      );
      expect(written.subarray(0, 7).toString('utf8')).toBe('OTENV1:');
      expect(written.includes(Buffer.from('hello'))).toBe(false);
      await expect(adapter.read(created)).resolves.toBe(
        `data:image/png;base64,${Buffer.from('hello').toString('base64')}`
      );
    });

    it('writes a raw buffer payload', async () => {
      const created = await adapter.create({
        name: 'raw.bin',
        profileId: 'profile-1',
        type: AssetType.DOCUMENT,
        content: Buffer.from('binary'),
      } as never);

      const written = await fs.readFile(
        path.join(basePath, created.storagePath)
      );
      expect(written.subarray(0, 7).toString('utf8')).toBe('OTENV1:');
      expect(written.includes(Buffer.from('binary'))).toBe(false);
    });

    it('copies from a source path when one is given', async () => {
      const source = path.join(basePath, 'source.txt');
      writeFileSync(source, 'copied');

      const created = await adapter.create({
        name: 'dest.txt',
        profileId: 'profile-1',
        type: AssetType.DOCUMENT,
        sourcePath: source,
      } as never);

      const written = await fs.readFile(
        path.join(basePath, created.storagePath)
      );
      expect(written.subarray(0, 7).toString('utf8')).toBe('OTENV1:');
      expect(written.includes(Buffer.from('copied'))).toBe(false);
      await expect(adapter.read(created)).resolves.toBe(
        `data:text/plain;base64,${Buffer.from('copied').toString('base64')}`
      );
    });

    it('replaces whitespace in the name so the path stays predictable', async () => {
      const created = await adapter.create({
        name: 'my holiday photo.png',
        profileId: 'profile-1',
        type: AssetType.IMAGE,
        content: Buffer.from('x'),
      } as never);

      expect(created.name).toBe('my_holiday_photo.png');
      expect(created.storagePath).toContain('my_holiday_photo.png');
    });

    it('gives each asset its own directory', async () => {
      const first = await adapter.create({
        name: 'same.png',
        profileId: 'p',
        type: AssetType.IMAGE,
        content: Buffer.from('one'),
      } as never);
      const second = await adapter.create({
        name: 'same.png',
        profileId: 'p',
        type: AssetType.IMAGE,
        content: Buffer.from('two'),
      } as never);

      expect(first.id).not.toBe(second.id);
      expect(first.storagePath).not.toBe(second.storagePath);
    });

    it('rejects a dto with no content and no source path', async () => {
      await expect(
        adapter.create({
          name: 'empty.png',
          profileId: 'p',
          type: AssetType.IMAGE,
        } as never)
      ).rejects.toThrow('File content is missing');
    });

    it('rejects content that is neither a data url nor a buffer', async () => {
      await expect(
        adapter.create({
          name: 'odd.png',
          profileId: 'p',
          type: AssetType.IMAGE,
          content: 'just a string',
        } as never)
      ).rejects.toThrow('Invalid content type');
    });
  });

  describe('purgeOwnedAsset', () => {
    const owned = (overrides: Partial<AssetDto> = {}) =>
      asset({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'owned.bin',
        storagePath: 'assets/11111111-1111-4111-8111-111111111111/owned.bin',
        ...overrides,
      });

    it('removes the owned directory contents, preserves siblings, and is idempotent', async () => {
      const id = '11111111-1111-4111-8111-111111111111';
      const directory = path.join(basePath, 'assets', id);
      const other = path.join(
        basePath,
        'assets',
        '22222222-2222-4222-8222-222222222222'
      );
      await fs.mkdir(directory, { recursive: true });
      await fs.mkdir(other, { recursive: true });
      await fs.writeFile(path.join(directory, 'owned.bin'), 'owned bytes');
      await fs.writeFile(path.join(directory, 'extra'), 'owned sibling');
      await fs.writeFile(path.join(other, 'keep'), 'other asset');

      await expect(adapter.purgeOwnedAsset!(owned())).resolves.toEqual({
        verifiedAbsent: true,
      });
      await expect(fs.lstat(directory)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await expect(fs.readFile(path.join(other, 'keep'), 'utf8')).resolves.toBe(
        'other asset'
      );
      await expect(adapter.purgeOwnedAsset!(owned())).resolves.toEqual({
        verifiedAbsent: true,
      });
    });

    it.each([
      ['wrong id', { id: 'not-a-uuid' }],
      [
        'wrong path',
        {
          storagePath: 'assets/11111111-1111-4111-8111-111111111111/other.bin',
        },
      ],
      [
        'wrong strategy',
        { storageStrategy: StorageStrategy.REMOTE_BLOCK_STORAGE },
      ],
    ])('rejects %s custody', async (_label, overrides) => {
      await expect(
        adapter.purgeOwnedAsset!(owned(overrides as Partial<AssetDto>))
      ).rejects.toThrow('custody');
    });

    it('rejects symlinks and hard links without following them', async () => {
      const id = '11111111-1111-4111-8111-111111111111';
      const directory = path.join(basePath, 'assets', id);
      const outside = path.join(basePath, 'outside');
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(outside, 'keep');
      symlinkSync(outside, path.join(directory, 'link'));
      await expect(adapter.purgeOwnedAsset!(owned())).rejects.toThrow(
        'Symlink'
      );
      await fs.unlink(path.join(directory, 'link'));
      await fs.writeFile(path.join(directory, 'owned.bin'), 'owned');
      linkSync(
        path.join(directory, 'owned.bin'),
        path.join(basePath, 'external-link')
      );
      await expect(adapter.purgeOwnedAsset!(owned())).rejects.toThrow(
        'Hard-linked'
      );
      expect(await fs.readFile(outside, 'utf8')).toBe('keep');
    });
  });

  describe('read', () => {
    it('returns the content as a data url with a mime type from the extension', async () => {
      const created = await adapter.create({
        name: 'photo.png',
        profileId: 'p',
        type: AssetType.IMAGE,
        content: Buffer.from('hello'),
      } as never);

      const result = await adapter.read(created);

      expect(result).toBe(
        `data:image/png;base64,${Buffer.from('hello').toString('base64')}`
      );
    });

    it('returns bounded authenticated plaintext without exposing the stored envelope', async () => {
      const payload = Buffer.from(
        'image bytes that should not be encrypted on the response'
      );
      const created = await adapter.create({
        name: 'bounded.png',
        profileId: 'p',
        type: AssetType.IMAGE,
        content: payload,
      } as never);
      const stored = await fs.readFile(
        path.join(basePath, created.storagePath)
      );

      await expect(adapter.readBuffer(created, stored.length)).resolves.toEqual(
        payload
      );
      await expect(
        adapter.readBuffer(created, stored.length - 1)
      ).rejects.toThrow('exceeds the supported retrieval size');
    });

    it('falls back to the asset type when the extension is unknown', async () => {
      const created = await adapter.create({
        name: 'clip.unknownext',
        profileId: 'p',
        type: AssetType.VIDEO,
        content: Buffer.from('v'),
      } as never);

      const result = await adapter.read(created);

      expect(result.startsWith('data:video/mp4;base64,')).toBe(true);
    });

    it.each([
      ['a.jpg', 'image/jpeg'],
      ['a.gif', 'image/gif'],
      ['a.svg', 'image/svg+xml'],
      ['a.mp4', 'video/mp4'],
      ['a.mov', 'video/quicktime'],
      ['a.mp3', 'audio/mpeg'],
      ['a.pdf', 'application/pdf'],
      ['a.md', 'text/markdown'],
      ['a.m3u8', 'application/vnd.apple.mpegurl'],
    ])('maps %s onto %s', async (name, mime) => {
      const created = await adapter.create({
        name,
        profileId: 'p',
        type: AssetType.IMAGE,
        content: Buffer.from('x'),
      } as never);

      const result = await adapter.read(created);

      expect(result.startsWith(`data:${mime};base64,`)).toBe(true);
    });

    it('rethrows when the file is not there', async () => {
      await expect(
        adapter.read(asset({ storagePath: 'assets/missing/none.png' }))
      ).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('refuses a persisted traversal path without touching a sibling sentinel', async () => {
      const sentinel = path.join(basePath, 'sentinel');
      writeFileSync(sentinel, 'keep');
      await expect(
        adapter.remove(asset({ storagePath: path.join('..', 'sentinel') }))
      ).rejects.toThrow('outside local storage');
      expect(existsSync(sentinel)).toBe(true);
    });
    it('deletes the stored file', async () => {
      const created = await adapter.create({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'gone.png',
        profileId: 'p',
        type: AssetType.IMAGE,
        content: Buffer.from('x'),
      } as never);
      const absolute = path.join(basePath, created.storagePath);
      expect(existsSync(absolute)).toBe(true);
      const crashTemp = path.join(path.dirname(absolute), '.gone.png.abcd.tmp');
      writeFileSync(crashTemp, 'partial');

      await adapter.remove(created);

      expect(existsSync(absolute)).toBe(false);
      expect(existsSync(crashTemp)).toBe(false);
    });

    it('treats a missing file as already removed', async () => {
      await expect(
        adapter.remove(asset({ storagePath: 'assets/missing/none.png' }))
      ).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('rethrows an error that is not a missing file', async () => {
      // A directory where a file is expected: unlink fails with EISDIR/EPERM
      // rather than ENOENT, which is the branch that must propagate.
      const dirPath = path.join(basePath, 'assets', 'a-directory');
      await fs.mkdir(dirPath, { recursive: true });

      await expect(
        adapter.remove(
          asset({ storagePath: path.join('assets', 'a-directory') })
        )
      ).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('retrieve', () => {
    it('fails closed instead of returning placeholder metadata', async () => {
      await expect(adapter.retrieve(asset({ id: 'asset-9' }))).rejects.toThrow(
        NotImplementedException
      );
    });
  });
});
