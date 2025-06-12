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
    (PutObjectCommand as jest.Mock).mockClear();
    (DeleteObjectCommand as jest.Mock).mockClear();
    (GetObjectCommand as jest.Mock).mockClear();

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

  // Add tests for uploadObject, deleteObject, getObject, and getKeyFromPath methods here
});