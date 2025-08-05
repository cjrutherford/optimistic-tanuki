import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { LocalStorageAdapter } from './local-storage'; // Assuming index.ts exports LocalStorageAdapter
import { AssetDto, CreateAssetDto } from '@optimistic-tanuki/models';
import * as fs from 'fs/promises'; // Import fs/promises for mocking
import * as path from 'path'; // Import path
import { v4 as uuidv4 } from 'uuid'; // Import uuid for mocking

// Mock the fs/promises module
jest.mock('fs/promises');
// Mock the uuid module
jest.mock('uuid');

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let mockLogger: Logger;
  const basePath = '/tmp/test/local/storage';
  const mockUuid = 'mock-uuid';

  beforeEach(async () => {
    // Reset mocks before each test
    (fs.writeFile as jest.Mock).mockReset();
    (fs.readFile as jest.Mock).mockReset();
    (fs.unlink as jest.Mock).mockReset();
    (fs.mkdir as jest.Mock).mockReset();
    (uuidv4 as jest.Mock).mockReturnValue(mockUuid);

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      // Add other logger methods if used
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: LocalStorageAdapter,
          useFactory: (logger: Logger) => new LocalStorageAdapter(logger, basePath),
          inject: [Logger],
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    adapter = module.get<LocalStorageAdapter>(LocalStorageAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  // Add tests for create, remove, retrieve, and read methods here
});