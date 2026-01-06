import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { S3Service, S3ServiceOptions } from './s3.service';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Mock the S3Client and its commands
jest.mock('@aws-sdk/client-s3');

describe('S3Service', () => {
  let service: S3Service;
  let mockLogger: Logger;
  let mockS3Client: jest.Mocked<S3Client>;

  const s3Options: S3ServiceOptions = {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
  };

  beforeEach(async () => {
    // Reset mocks before each test
    (S3Client as jest.Mock).mockClear();

    // Create a mock S3Client instance
    mockS3Client = {
        send: jest.fn(),
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

  describe('uploadObject', () => {
    it('should successfully upload an object to S3', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const key = 'test-file.txt';
      const body = Buffer.from('test content');
      const contentType = 'text/plain';

      await service.uploadObject(key, body, contentType);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: s3Options.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
          }),
        })
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(`Uploading object to s3://${s3Options.bucketName}/${key}`)
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

      await expect(service.uploadObject(key, body)).rejects.toThrow('Upload failed');
    });
  });

  describe('deleteObject', () => {
    it('should successfully delete an object from S3', async () => {
      mockS3Client.send.mockResolvedValueOnce({});

      const key = 'test-file.txt';

      await service.deleteObject(key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: s3Options.bucketName,
            Key: key,
          }),
        })
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(`Deleting object from s3://${s3Options.bucketName}/${key}`)
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
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: s3Options.bucketName,
            Key: key,
          }),
        })
      );
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
});