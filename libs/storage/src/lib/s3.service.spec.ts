import { Test, TestingModule } from '@nestjs/testing';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ObjectLockMode,
  S3Client,
  DeleteObjectsCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetBucketVersioningCommand,
  GetObjectLockConfigurationCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import {
  ObjectLockSettings,
  resolveObjectLockSettings,
  resolveS3ServiceOptions,
  S3Service,
  S3ServiceOptions,
} from './s3.service';

// Mock the S3Client and its commands
jest.mock('@aws-sdk/client-s3');

describe('S3Service', () => {
  let service: S3Service;
  let mockLogger: Logger;
  let mockS3Client: any;

  const s3Options: S3ServiceOptions = {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
  };

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a mock S3Client instance
    mockS3Client = {
      send: jest.fn() as jest.Mock<any, any>,
    } as any;
    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      // Add other logger methods if used
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: S3Service,
          useFactory: (logger: Logger) => new S3Service(logger, s3Options),
          inject: [Logger],
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the S3 body stream and forwards cancellation to the SDK request', async () => {
    const body = Readable.from([Buffer.from('first'), Buffer.from('second')]);
    const signal = new AbortController().signal;
    mockS3Client.send.mockResolvedValueOnce({ Body: body });

    const result = await service.getObjectStream('media/key', signal);

    expect(result).toBe(body);
    expect(mockS3Client.send).toHaveBeenCalledWith(
      expect.any(GetObjectCommand),
      { abortSignal: signal }
    );
  });

  it('propagates an S3 body request failure instead of returning partial media', async () => {
    const failure = new Error('controlled S3 stream failure');
    mockS3Client.send.mockRejectedValueOnce(failure);

    await expect(service.getObjectStream('media/key')).rejects.toBe(failure);
  });

  describe('uploadObject', () => {
    it('should successfully upload an object to S3', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const key = 'test-file.txt';
      const body = Buffer.from('test content');
      const contentType = 'text/plain';

      await service.uploadObject(key, body, contentType);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          `Uploading object to s3://${s3Options.bucketName}/${key}`
        )
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Object uploaded successfully')
      );
    });

    it('should upload without content type', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const key = 'test-file.bin';
      const body = Buffer.from('binary content');

      await service.uploadObject(key, body);

      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should throw error on upload failure', async () => {
      const error = new Error('Upload failed');
      mockS3Client.send.mockRejectedValueOnce(error);

      const key = 'test-file.txt';
      const body = Buffer.from('test content');

      await expect(service.uploadObject(key, body)).rejects.toThrow(
        'Upload failed'
      );
    });
  });

  describe('deleteObject', () => {
    it('should successfully delete an object from S3', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const key = 'test-file.txt';

      await service.deleteObject(key);

      expect(mockS3Client.send).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          `Deleting object from s3://${s3Options.bucketName}/${key}`
        )
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Object deleted successfully')
      );
    });

    it('should handle NoSuchKey error gracefully', async () => {
      const error: any = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      mockS3Client.send.mockRejectedValueOnce(error);

      const key = 'non-existent-file.txt';

      await service.deleteObject(key);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to delete non-existent object')
      );
    });

    it('should throw error on delete failure (non-NoSuchKey)', async () => {
      const error = new Error('Delete failed');
      (error as any).name = 'SomeOtherError';
      mockS3Client.send.mockRejectedValueOnce(error);

      const key = 'test-file.txt';

      await expect(service.deleteObject(key)).rejects.toThrow('Delete failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('shared-store custody probe', () => {
    const nonce = '9a5bfbf1-4f4a-4aa9-8fab-7d769ee03232';
    it('writes exclusively, reads the exact bounded nonce and returns no credentials', async () => {
      mockS3Client.send
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Body: Readable.from([Buffer.from(nonce)]) });
      const written = await service.custodyProbe(nonce, 'write');
      expect(written).toMatch(/^s3:[0-9a-f]{64}$/);
      expect(written).not.toContain(s3Options.secretAccessKey);
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: '.ot-store-probe/' + nonce,
          Body: nonce,
          IfNoneMatch: '*',
        })
      );
      await expect(service.custodyProbe(nonce, 'read')).resolves.toBe(written);
    });
    it('rejects a mismatched or oversized response and invalid nonce without a request', async () => {
      await expect(service.custodyProbe('../unsafe', 'read')).rejects.toThrow(
        'CUSTODY_PROBE_INVALID'
      );
      expect(mockS3Client.send).not.toHaveBeenCalled();
      mockS3Client.send.mockResolvedValueOnce({
        Body: Readable.from([Buffer.alloc(37)]),
      });
      await expect(service.custodyProbe(nonce, 'read')).rejects.toThrow(
        'CUSTODY_PROBE_INVALID'
      );
      mockS3Client.send.mockResolvedValueOnce({
        Body: Readable.from([Buffer.from(nonce.replace('9', '8'))]),
      });
      await expect(service.custodyProbe(nonce, 'read')).rejects.toThrow(
        'CUSTODY_PROBE_INVALID'
      );
    });
    it('removes the probe through version-aware purge with independent absence readback', async () => {
      const key = '.ot-store-probe/' + nonce;
      mockS3Client.send
        .mockResolvedValueOnce({ Versions: [{ Key: key, VersionId: 'v1' }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Versions: [] })
        .mockRejectedValueOnce(
          Object.assign(new Error('absent'), {
            name: 'NotFound',
            $metadata: { httpStatusCode: 404 },
          })
        );
      await expect(service.custodyProbe(nonce, 'remove')).resolves.toMatch(
        /^s3:[0-9a-f]{64}$/
      );
      expect(DeleteObjectsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Delete: { Objects: [{ Key: key, VersionId: 'v1' }], Quiet: false },
        })
      );
    });
  });

  describe('purgeObjectVersions', () => {
    it('paginates versions and delete markers and only deletes the exact key', async () => {
      mockS3Client.send
        .mockResolvedValueOnce({
          Versions: [{ Key: 'asset', VersionId: 'v1' }],
          DeleteMarkers: [
            { Key: 'asset', VersionId: 'd1' },
            { Key: 'asset-neighbor', VersionId: 'neighbor' },
          ],
          IsTruncated: true,
          NextKeyMarker: 'asset',
          NextVersionIdMarker: 'd1',
        })
        .mockResolvedValueOnce({
          Versions: [{ Key: 'asset', VersionId: 'v2' }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Versions: [], DeleteMarkers: [] })
        .mockRejectedValueOnce(
          Object.assign(new Error('missing'), {
            name: 'NotFound',
            $metadata: { httpStatusCode: 404 },
          })
        );
      await service.purgeObjectVersions('asset');
      const deletes = mockS3Client.send.mock.calls.filter(
        ([command]: any[]) => command instanceof DeleteObjectsCommand
      );
      expect(deletes).toHaveLength(1);
      expect(
        (DeleteObjectsCommand as unknown as jest.Mock).mock.calls[0][0].Delete
          .Objects
      ).toEqual([
        { Key: 'asset', VersionId: 'v1' },
        { Key: 'asset', VersionId: 'd1' },
        { Key: 'asset', VersionId: 'v2' },
      ]);
      expect(
        (ListObjectVersionsCommand as unknown as jest.Mock).mock.calls[1][0]
      ).toMatchObject({
        KeyMarker: 'asset',
        VersionIdMarker: 'd1',
      });
      expect(mockS3Client.send.mock.calls.at(-1)[0]).toBeInstanceOf(
        HeadObjectCommand
      );
    });

    it('fails on partial delete response and permits retry', async () => {
      mockS3Client.send
        .mockResolvedValueOnce({
          Versions: [{ Key: 'asset', VersionId: 'v1' }],
        })
        .mockResolvedValueOnce({
          Errors: [{ Key: 'asset', VersionId: 'v1', Code: 'AccessDenied' }],
        });
      await expect(service.purgeObjectVersions('asset')).rejects.toThrow(
        'partially failed'
      );

      mockS3Client.send
        .mockReset()
        .mockResolvedValueOnce({
          Versions: [{ Key: 'asset', VersionId: 'v1' }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Versions: [] })
        .mockRejectedValueOnce(
          Object.assign(new Error('missing'), {
            name: 'NotFound',
            $metadata: { httpStatusCode: 404 },
          })
        );
      await expect(
        service.purgeObjectVersions('asset')
      ).resolves.toBeUndefined();
    });
  });

  describe('getObject', () => {
    it('should successfully retrieve an object from S3', async () => {
      const testContent = 'test file content';
      const mockStream = Readable.from([Buffer.from(testContent)]);

      mockS3Client.send.mockResolvedValueOnce({
        Body: mockStream,
      });

      const key = 'test-file.txt';
      const result = await service.getObject(key);

      expect(result.toString()).toBe(testContent);
      expect(mockS3Client.send).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Object content retrieved')
      );
    });

    it('should throw error when Body is missing', async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Body: undefined,
      });

      const key = 'test-file.txt';

      await expect(service.getObject(key)).rejects.toThrow(
        'No content body received'
      );
    });

    it('should throw error on retrieval failure', async () => {
      const error = new Error('Get failed');
      mockS3Client.send.mockRejectedValueOnce(error);

      const key = 'test-file.txt';

      await expect(service.getObject(key)).rejects.toThrow('Get failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getKeyFromPath', () => {
    it('should extract key from valid S3 path', () => {
      const s3Path = `s3://${s3Options.bucketName}/folder/file.txt`;
      const key = service.getKeyFromPath(s3Path);

      expect(key).toBe('folder/file.txt');
    });

    it('should handle nested paths', () => {
      const s3Path = `s3://${s3Options.bucketName}/a/b/c/file.txt`;
      const key = service.getKeyFromPath(s3Path);

      expect(key).toBe('a/b/c/file.txt');
    });

    it('should throw error for invalid path format', () => {
      const invalidPath = 'invalid-path/file.txt';

      expect(() => service.getKeyFromPath(invalidPath)).toThrow(
        'Invalid S3 path format'
      );
    });

    it('should throw error for wrong bucket', () => {
      const wrongBucketPath = 's3://wrong-bucket/file.txt';

      expect(() => service.getKeyFromPath(wrongBucketPath)).toThrow(
        'Invalid S3 path format'
      );
    });
  });

  describe('configuration resolution', () => {
    it('never defaults credentials and fails closed when they are missing', () => {
      expect(() => resolveS3ServiceOptions({})).toThrow(
        ServiceUnavailableException
      );
      expect(() => resolveS3ServiceOptions({})).toThrow(
        /VAULT_STORAGE_S3_ACCESS_KEY_ID, VAULT_STORAGE_S3_SECRET_ACCESS_KEY, VAULT_STORAGE_S3_BUCKET/
      );
    });

    it('does not ship a minioadmin default', () => {
      const resolved = resolveS3ServiceOptions({
        VAULT_STORAGE_S3_ACCESS_KEY_ID: 'wasabi-key',
        VAULT_STORAGE_S3_SECRET_ACCESS_KEY: 'wasabi-secret',
        VAULT_STORAGE_S3_BUCKET: 'practice-vault',
      });

      expect(resolved.accessKeyId).toBe('wasabi-key');
      expect(resolved.secretAccessKey).toBe('wasabi-secret');
      expect(resolved.accessKeyId).not.toBe('minioadmin');
      expect(resolved.secretAccessKey).not.toBe('minioadmin');
    });

    it('keeps the local dev endpoint only when credentials come from the environment', () => {
      const resolved = resolveS3ServiceOptions({
        VAULT_STORAGE_S3_ACCESS_KEY_ID: 'local-key',
        VAULT_STORAGE_S3_SECRET_ACCESS_KEY: 'local-secret',
        VAULT_STORAGE_S3_BUCKET: 'vault',
      });

      expect(resolved.endpoint).toBe('http://localhost:9000');
      expect(resolved.region).toBe('us-east-1');
    });

    it('prefers an explicit wasabi endpoint from the environment', () => {
      const resolved = resolveS3ServiceOptions({
        VAULT_STORAGE_S3_ENDPOINT: 'https://s3.wasabisys.com',
        VAULT_STORAGE_S3_REGION: 'us-east-1',
        VAULT_STORAGE_S3_ACCESS_KEY_ID: 'wasabi-key',
        VAULT_STORAGE_S3_SECRET_ACCESS_KEY: 'wasabi-secret',
        VAULT_STORAGE_S3_BUCKET: 'practice-vault',
      });

      expect(resolved.endpoint).toBe('https://s3.wasabisys.com');
    });

    it('refuses to construct a service without explicit credentials', () => {
      expect(
        () =>
          new S3Service(mockLogger, {
            endpoint: 'http://localhost:9000',
            region: 'us-east-1',
            accessKeyId: '',
            secretAccessKey: '',
            bucketName: 'vault',
          })
      ).toThrow(ServiceUnavailableException);
    });

    describe('object lock settings', () => {
      it('is absent unless configured', () => {
        expect(resolveObjectLockSettings({})).toBeUndefined();
      });

      it('derives a retain until date from a day count', () => {
        const before = Date.now();
        const settings = resolveObjectLockSettings({
          VAULT_STORAGE_OBJECT_LOCK_MODE: 'compliance',
          VAULT_STORAGE_OBJECT_LOCK_RETAIN_DAYS: '2555',
          VAULT_STORAGE_OBJECT_LOCK_LEGAL_HOLD: 'on',
        });

        expect(settings?.mode).toBe(ObjectLockMode.COMPLIANCE);
        expect(settings?.legalHold).toBe('ON');
        expect(settings?.retainUntilDate?.getTime()).toBeGreaterThan(
          before + 2554 * 24 * 60 * 60 * 1000
        );
      });

      it('rejects an unsupported mode', () => {
        expect(() =>
          resolveObjectLockSettings({
            VAULT_STORAGE_OBJECT_LOCK_MODE: 'EXEMPT',
          })
        ).toThrow(/must be COMPLIANCE or GOVERNANCE/);
      });

      it('rejects a non positive retain period', () => {
        expect(() =>
          resolveObjectLockSettings({
            VAULT_STORAGE_OBJECT_LOCK_MODE: 'GOVERNANCE',
            VAULT_STORAGE_OBJECT_LOCK_RETAIN_DAYS: '0',
          })
        ).toThrow(/positive number of days/);
      });

      it('rejects an unsupported legal hold status', () => {
        expect(() =>
          resolveObjectLockSettings({
            VAULT_STORAGE_OBJECT_LOCK_MODE: 'GOVERNANCE',
            VAULT_STORAGE_OBJECT_LOCK_LEGAL_HOLD: 'MAYBE',
          })
        ).toThrow(/must be ON or OFF/);
      });
    });
  });

  describe('object lock', () => {
    const buildService = async (
      options: Partial<S3ServiceOptions>
    ): Promise<S3Service> => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: S3Service,
            useFactory: (logger: Logger) =>
              new S3Service(logger, { ...s3Options, ...options }),
            inject: [Logger],
          },
          { provide: Logger, useValue: mockLogger },
        ],
      }).compile();
      return module.get<S3Service>(S3Service);
    };

    const sentCommands = (): unknown[] =>
      mockS3Client.send.mock.calls.map((call: unknown[]) => call[0]);

    const putCommandInput = (): Record<string, unknown> | undefined => {
      const calls = (PutObjectCommand as unknown as jest.Mock).mock
        .calls as unknown[][];
      return calls[calls.length - 1]?.[0] as
        | Record<string, unknown>
        | undefined;
    };

    const lockReady = (): void => {
      mockS3Client.send
        .mockResolvedValueOnce({ Status: 'Enabled' })
        .mockResolvedValueOnce({
          ObjectLockConfiguration: { ObjectLockEnabled: 'Enabled' },
        });
    };

    it('sends the governance mode, retain until date and legal hold headers', async () => {
      const locked = await buildService({});
      const retainUntilDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const objectLock: ObjectLockSettings = {
        mode: ObjectLockMode.GOVERNANCE,
        retainUntilDate,
        legalHold: 'ON',
      };
      lockReady();
      mockS3Client.send.mockResolvedValueOnce({});

      await locked.uploadObject(
        'vault/1040.bin',
        Buffer.from('envelope'),
        'document',
        {
          objectLock,
        }
      );

      expect(putCommandInput()?.['ObjectLockMode']).toBe(
        ObjectLockMode.GOVERNANCE
      );
      expect(putCommandInput()?.['ObjectLockRetainUntilDate']).toBe(
        retainUntilDate
      );
      expect(putCommandInput()?.['ObjectLockLegalHoldStatus']).toBe('ON');
    });

    it('sends compliance mode when that is what is configured', async () => {
      const locked = await buildService({
        objectLock: { mode: ObjectLockMode.COMPLIANCE },
      });
      lockReady();
      mockS3Client.send.mockResolvedValueOnce({});

      await locked.uploadObject('vault/1040.bin', Buffer.from('envelope'));

      expect(putCommandInput()?.['ObjectLockMode']).toBe(
        ObjectLockMode.COMPLIANCE
      );
    });

    it('applies the object lock configured on the service to every upload', async () => {
      const locked = await buildService({
        objectLock: { mode: ObjectLockMode.GOVERNANCE, legalHold: 'OFF' },
      });
      lockReady();
      mockS3Client.send.mockResolvedValueOnce({});

      await locked.uploadObject('vault/1099.bin', Buffer.from('envelope'));

      expect(putCommandInput()?.['ObjectLockMode']).toBe(
        ObjectLockMode.GOVERNANCE
      );
      expect(putCommandInput()?.['ObjectLockLegalHoldStatus']).toBe('OFF');
    });

    it('sends no object lock headers when no lock is configured', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      await service.uploadObject('plain.txt', Buffer.from('bytes'));

      expect(
        sentCommands().some((command) => command instanceof PutObjectCommand)
      ).toBe(true);
      const input = putCommandInput();
      expect(input).toBeDefined();
      expect(Object.keys(input ?? {})).not.toContain('ObjectLockMode');
      expect(Object.keys(input ?? {})).not.toContain(
        'ObjectLockRetainUntilDate'
      );
      expect(Object.keys(input ?? {})).not.toContain(
        'ObjectLockLegalHoldStatus'
      );
    });

    it('forwards classification metadata on the object', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      await service.uploadObject(
        'vault/1040.bin',
        Buffer.from('envelope'),
        'document',
        {
          metadata: {
            'vault-tax-document': 'true',
            'vault-form-type': 'FORM_1040',
            'vault-handling': 'TAX_STRICT',
          },
        }
      );

      expect(putCommandInput()?.['Metadata']).toEqual({
        'vault-tax-document': 'true',
        'vault-form-type': 'FORM_1040',
        'vault-handling': 'TAX_STRICT',
      });
    });

    it('refuses a retain until date in the past', async () => {
      const locked = await buildService({});

      await expect(
        locked.uploadObject(
          'vault/1040.bin',
          Buffer.from('envelope'),
          undefined,
          {
            objectLock: {
              mode: ObjectLockMode.GOVERNANCE,
              retainUntilDate: new Date(Date.now() - 1000),
            },
          }
        )
      ).rejects.toThrow('retain-until date must be in the future');
    });

    it('refuses an unsupported object lock mode', async () => {
      const locked = await buildService({});

      await expect(
        locked.uploadObject(
          'vault/1040.bin',
          Buffer.from('envelope'),
          undefined,
          {
            objectLock: { mode: 'EXEMPT' as ObjectLockMode },
          }
        )
      ).rejects.toThrow('Unsupported Object Lock mode');
    });

    it('refuses an unsupported legal hold status', async () => {
      const locked = await buildService({});

      await expect(
        locked.uploadObject(
          'vault/1040.bin',
          Buffer.from('envelope'),
          undefined,
          {
            objectLock: {
              mode: ObjectLockMode.GOVERNANCE,
              legalHold: 'MAYBE' as 'ON',
            },
          }
        )
      ).rejects.toThrow('Unsupported Object Lock legal hold status');
    });

    it('denies the upload when bucket versioning is not enabled', async () => {
      const locked = await buildService({});
      mockS3Client.send.mockResolvedValueOnce({}).mockResolvedValueOnce({
        ObjectLockConfiguration: { ObjectLockEnabled: 'Enabled' },
      });

      await expect(
        locked.uploadObject(
          'vault/1040.bin',
          Buffer.from('envelope'),
          undefined,
          {
            objectLock: { mode: ObjectLockMode.COMPLIANCE },
          }
        )
      ).rejects.toThrow(/versioning/i);

      expect(
        sentCommands().some((command) => command instanceof PutObjectCommand)
      ).toBe(false);
    });

    it('denies the upload when object lock is not enabled on the bucket', async () => {
      const locked = await buildService({});
      mockS3Client.send
        .mockResolvedValueOnce({ Status: 'Enabled' })
        .mockResolvedValueOnce({});

      await expect(
        locked.uploadObject(
          'vault/1040.bin',
          Buffer.from('envelope'),
          undefined,
          {
            objectLock: { mode: ObjectLockMode.COMPLIANCE },
          }
        )
      ).rejects.toThrow(/Object Lock not enabled/);
    });

    it('denies the upload when the bucket cannot be inspected', async () => {
      const locked = await buildService({});
      mockS3Client.send.mockRejectedValueOnce(new Error('access denied'));

      await expect(
        locked.uploadObject(
          'vault/1040.bin',
          Buffer.from('envelope'),
          undefined,
          {
            objectLock: { mode: ObjectLockMode.COMPLIANCE },
          }
        )
      ).rejects.toThrow(/access denied/);
    });

    it('checks bucket readiness with the versioning and object lock commands', async () => {
      const locked = await buildService({});
      lockReady();
      mockS3Client.send.mockResolvedValueOnce({});

      await locked.uploadObject(
        'vault/1040.bin',
        Buffer.from('envelope'),
        undefined,
        {
          objectLock: { mode: ObjectLockMode.GOVERNANCE },
        }
      );

      expect(
        sentCommands().some(
          (command) => command instanceof GetBucketVersioningCommand
        )
      ).toBe(true);
      expect(
        sentCommands().some(
          (command) => command instanceof GetObjectLockConfigurationCommand
        )
      ).toBe(true);
    });

    it('caches the readiness probe across uploads', async () => {
      const locked = await buildService({});
      lockReady();
      mockS3Client.send
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await locked.uploadObject('a.bin', Buffer.from('x'), undefined, {
        objectLock: { mode: ObjectLockMode.GOVERNANCE },
      });
      await locked.uploadObject('b.bin', Buffer.from('x'), undefined, {
        objectLock: { mode: ObjectLockMode.GOVERNANCE },
      });

      const versionChecks = sentCommands().filter(
        (command) => command instanceof GetBucketVersioningCommand
      );
      expect(versionChecks).toHaveLength(1);
    });

    it('can be told to skip the readiness probe explicitly', async () => {
      const locked = await buildService({
        requireVersioningForObjectLock: false,
      });
      mockS3Client.send.mockResolvedValueOnce({});

      await locked.uploadObject(
        'vault/1040.bin',
        Buffer.from('envelope'),
        undefined,
        {
          objectLock: { mode: ObjectLockMode.GOVERNANCE },
        }
      );

      expect(
        sentCommands().every(
          (command) => !(command instanceof GetBucketVersioningCommand)
        )
      ).toBe(true);
    });

    it('reports a truthful readiness summary', async () => {
      const locked = await buildService({});
      lockReady();

      await expect(locked.getObjectLockReadiness()).resolves.toEqual({
        bucketName: s3Options.bucketName,
        versioningEnabled: true,
        objectLockEnabled: true,
        ready: true,
        detail: expect.stringContaining('retention headers will be honoured'),
      });
    });
  });
});
