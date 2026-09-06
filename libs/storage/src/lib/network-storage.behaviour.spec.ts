import { Logger } from '@nestjs/common';
import {
  AssetDto,
  AssetType,
  StorageStrategy,
} from '@optimistic-tanuki/models';
import { NetworkStorageAdapter } from './network-storage';
import { S3Service } from './s3.service';

// uuid ships as ESM, which this project's jest transform does not parse.
jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-1') }));

/**
 * The adapter is a thin translation between AssetDto and S3 keys. What matters
 * is the key it builds, the storagePath it hands back, and that a failure from
 * S3 propagates rather than being swallowed into a half-created asset.
 */
describe('NetworkStorageAdapter behaviour', () => {
  interface S3Mock {
    uploadObject: jest.Mock;
    deleteObject: jest.Mock;
    getObject: jest.Mock;
    getKeyFromPath: jest.Mock;
    bucketName: string;
  }

  let s3: S3Mock;
  let logger: Logger;
  let adapter: NetworkStorageAdapter;

  const asset = (overrides: Partial<AssetDto> = {}): AssetDto =>
    ({
      id: 'asset-1',
      name: 'file.png',
      storagePath: 's3://test-bucket/assets/profile-1/uuid-1-123/file.png',
      type: AssetType.IMAGE,
      storageStrategy: StorageStrategy.REMOTE_BLOCK_STORAGE,
      profileId: 'profile-1',
      ...overrides,
    } as AssetDto);

  beforeEach(() => {
    s3 = {
      uploadObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn().mockResolvedValue(Buffer.from('content')),
      getKeyFromPath: jest.fn((p: string) => p.replace(/^s3:\/\/[^/]+\//, '')),
      bucketName: 'test-bucket',
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    adapter = new NetworkStorageAdapter(logger, s3 as unknown as S3Service);
  });

  describe('create', () => {
    it('uploads under a profile-scoped key and returns an s3:// path', async () => {
      const content = Buffer.from('bytes');

      const created = await adapter.create({
        name: 'photo.png',
        profileId: 'profile-9',
        type: AssetType.IMAGE,
        content,
      } as never);

      const [key, body, type] = s3.uploadObject.mock.calls[0];
      expect(key).toMatch(/^assets\/profile-9\/uuid-1-\d+\/photo\.png$/);
      expect(body).toBe(content);
      expect(type).toBe(AssetType.IMAGE);

      expect(created.storagePath).toBe(`s3://test-bucket/${key}`);
      expect(created.storageStrategy).toBe(
        StorageStrategy.REMOTE_BLOCK_STORAGE
      );
      expect(created.profileId).toBe('profile-9');
    });

    it('rejects a dto with no content before touching s3', async () => {
      await expect(
        adapter.create({
          name: 'empty.png',
          profileId: 'p',
          type: AssetType.IMAGE,
        } as never)
      ).rejects.toThrow('File content is missing');

      expect(s3.uploadObject).not.toHaveBeenCalled();
    });

    it('refuses content that has not been decoded to a Buffer', async () => {
      await expect(
        adapter.create({
          name: 'raw.png',
          profileId: 'p',
          type: AssetType.IMAGE,
          content: 'data:image/png;base64,YWJj',
        } as never)
      ).rejects.toThrow('must be a Buffer');

      expect(s3.uploadObject).not.toHaveBeenCalled();
    });

    it('propagates an upload failure rather than returning a partial asset', async () => {
      s3.uploadObject.mockRejectedValue(new Error('bucket unreachable'));

      await expect(
        adapter.create({
          name: 'photo.png',
          profileId: 'p',
          type: AssetType.IMAGE,
          content: Buffer.from('x'),
        } as never)
      ).rejects.toThrow('bucket unreachable');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the key derived from the stored path', async () => {
      await adapter.remove(asset());

      expect(s3.getKeyFromPath).toHaveBeenCalledWith(asset().storagePath);
      expect(s3.deleteObject).toHaveBeenCalledWith(
        'assets/profile-1/uuid-1-123/file.png'
      );
    });

    it('propagates a delete failure', async () => {
      s3.deleteObject.mockRejectedValue(new Error('access denied'));

      await expect(adapter.remove(asset())).rejects.toThrow('access denied');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('read', () => {
    it('returns the object bytes for the stored path', async () => {
      const result = await adapter.read(asset());

      expect(s3.getObject).toHaveBeenCalledWith(
        'assets/profile-1/uuid-1-123/file.png'
      );
      expect(result.toString()).toBe('content');
    });

    it('propagates a read failure', async () => {
      s3.getObject.mockRejectedValue(new Error('no such key'));

      await expect(adapter.read(asset())).rejects.toThrow('no such key');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('retrieve', () => {
    it('echoes the metadata back without calling s3', async () => {
      const input = asset();

      const result = await adapter.retrieve(input);

      expect(result).toBe(input);
      expect(s3.getObject).not.toHaveBeenCalled();
    });
  });
});
