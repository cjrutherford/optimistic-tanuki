import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NetworkStorageAdapter } from './network-storage';
import { S3Service } from './s3.service';
import { AssetDto, CreateAssetDto } from '@optimistic-tanuki/models';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { VerifiedMediaSpoolService } from './verified-media-spool.service';

// Mock the S3Service
jest.mock('./s3.service');
// Mock the uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

describe('NetworkStorageAdapter', () => {
  let adapter: NetworkStorageAdapter;
  let mockLogger: Logger;
  let mockS3Service: jest.Mocked<S3Service>;

  beforeEach(async () => {
    // Reset mocks before each test
    mockS3Service = {
      uploadObject: jest.fn(),
      purgeObjectVersions: jest.fn(),
      getObject: jest.fn(),
      getKeyFromPath: jest.fn((s3Path: string) =>
        s3Path.replace('s3://test-bucket/', '')
      ),
      // Mock the bucketName property if accessed directly
      bucketName: 'test-bucket',
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      // Add other logger methods if used
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NetworkStorageAdapter,
          useFactory: (logger: Logger, s3Service: S3Service) =>
            new NetworkStorageAdapter(logger, s3Service),
          inject: [Logger, S3Service],
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    adapter = module.get<NetworkStorageAdapter>(NetworkStorageAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('purgeOwnedAsset', () => {
    const owned = (overrides: Partial<AssetDto> = {}) =>
      ({
        id: '11111111-1111-4111-8111-111111111111',
        profileId: '22222222-2222-4222-8222-222222222222',
        name: 'owned.png',
        storageStrategy: 'remote_block_storage',
        storagePath:
          's3://test-bucket/assets/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/owned.png',
        type: 'image',
        ...overrides,
      } as AssetDto);

    it('validates exact custody before purging and returns the receipt after success', async () => {
      mockS3Service.purgeObjectVersions.mockResolvedValue(undefined);
      await expect(adapter.purgeOwnedAsset!(owned())).resolves.toEqual({
        verifiedAbsent: true,
      });
      expect(mockS3Service.purgeObjectVersions).toHaveBeenCalledWith(
        'assets/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/owned.png'
      );
      mockS3Service.purgeObjectVersions.mockClear();
      await expect(
        adapter.purgeOwnedAsset!(
          owned({ storagePath: 's3://test-bucket/assets/other' })
        )
      ).rejects.toThrow('custody');
      await expect(
        adapter.purgeOwnedAsset!(owned({ id: 'legacy-id' }))
      ).rejects.toThrow('custody');
      expect(mockS3Service.purgeObjectVersions).not.toHaveBeenCalled();
    });

    it('purges the normalized reservation key when the asset name contains spaces', async () => {
      mockS3Service.purgeObjectVersions.mockResolvedValue(undefined);
      const spaced = owned({
        name: 'photo name.png',
        storagePath:
          's3://test-bucket/assets/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/photo_name.png',
      });
      await expect(adapter.purgeOwnedAsset!(spaced)).resolves.toEqual({
        verifiedAbsent: true,
      });
      expect(mockS3Service.getKeyFromPath).toHaveBeenCalledWith(
        spaced.storagePath
      );
      expect(mockS3Service.purgeObjectVersions).toHaveBeenCalledWith(
        'assets/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/photo_name.png'
      );
      mockS3Service.purgeObjectVersions.mockClear();
      await expect(
        adapter.purgeOwnedAsset!(
          owned({
            ...spaced,
            storagePath: 's3://test-bucket/assets/wrong/path',
          })
        )
      ).rejects.toThrow('custody');
      expect(mockS3Service.purgeObjectVersions).not.toHaveBeenCalled();
    });

    it('propagates purge failures without returning a receipt', async () => {
      mockS3Service.purgeObjectVersions.mockRejectedValue(
        new Error('versions remain')
      );
      await expect(adapter.purgeOwnedAsset!(owned())).rejects.toThrow(
        'versions remain'
      );
    });
  });

  it('authenticates an S3 response stream without calling the Buffer reader', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rr10-s3-stream-'));
    const encryption = new EnvelopeEncryptionService({
      VAULT_STORAGE_KEK: 'isolated-s3-stream-test-key',
    });
    const spool = new VerifiedMediaSpoolService(encryption, {
      spoolRoot: root,
      maxPlaintextBytes: 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024 * 1024,
    });
    const body = encryption.encrypt(Buffer.from('authenticated s3 body'));
    const chunks = [body.subarray(0, 32), body.subarray(32)];
    const getObjectStream = jest.fn().mockResolvedValue(Readable.from(chunks));
    const s3 = {
      getKeyFromPath: jest.fn().mockReturnValue('assets/test/video.mp4'),
      getObjectStream,
      getObject: jest.fn(),
    } as any;
    const networkAdapter = new NetworkStorageAdapter(
      mockLogger,
      s3,
      encryption,
      undefined,
      spool
    );

    try {
      const media = await networkAdapter.openAuthenticatedMedia(
        { storagePath: 's3://test-bucket/assets/test/video.mp4' } as AssetDto,
        { maxPlaintextBytes: 1024 }
      );
      const output: Buffer[] = [];
      for await (const chunk of media.createReadStream()) {
        output.push(Buffer.from(chunk));
      }
      await media.cleanup();

      expect(Buffer.concat(output)).toEqual(
        Buffer.from('authenticated s3 body')
      );
      expect(getObjectStream).toHaveBeenCalledWith(
        'assets/test/video.mp4',
        undefined
      );
      expect(s3.getObject).not.toHaveBeenCalled();
      expect(await readdir(spool.processDirectory)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('propagates abort into an in-flight S3 stream and removes the partial spool', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rr10-s3-abort-'));
    const encryption = new EnvelopeEncryptionService({
      VAULT_STORAGE_KEK: 'isolated-s3-abort-test-key',
    });
    const spool = new VerifiedMediaSpoolService(encryption, {
      spoolRoot: root,
      maxPlaintextBytes: 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024 * 1024,
    });
    const body = new PassThrough();
    const getObjectStream = jest.fn().mockResolvedValue(body);
    const s3 = {
      getKeyFromPath: jest.fn().mockReturnValue('assets/test/video.mp4'),
      getObjectStream,
      getObject: jest.fn(),
    } as any;
    const networkAdapter = new NetworkStorageAdapter(
      mockLogger,
      s3,
      encryption,
      undefined,
      spool
    );
    const abortController = new AbortController();

    try {
      const pending = networkAdapter.openAuthenticatedMedia(
        { storagePath: 's3://test-bucket/assets/test/video.mp4' } as AssetDto,
        { maxPlaintextBytes: 1024, signal: abortController.signal }
      );
      const sourceDeadline = Date.now() + 2000;
      while (
        getObjectStream.mock.calls.length === 0 &&
        Date.now() < sourceDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(getObjectStream).toHaveBeenCalledTimes(1);
      abortController.abort();
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });

      expect(getObjectStream).toHaveBeenCalledWith(
        'assets/test/video.mp4',
        abortController.signal
      );
      expect(body.destroyed).toBe(true);
      expect(await readdir(spool.processDirectory)).toEqual([]);
      expect(s3.getObject).not.toHaveBeenCalled();
    } finally {
      body.destroy();
      await rm(root, { recursive: true, force: true });
    }
  });

  // Add tests for create, remove, retrieve, and read methods here
});
