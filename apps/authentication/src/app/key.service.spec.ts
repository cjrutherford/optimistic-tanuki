import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { Test, TestingModule } from '@nestjs/testing';

import { AsymmetricService } from '@optimistic-tanuki/encryption';
import { KeyService } from './key.service';

jest.mock('fs/promises');
jest.mock('fs');

describe('KeyService', () => {
  let service: KeyService;
  let asymmetricService: AsymmetricService;
  const originalAuthKeyCacheDir = process.env['AUTH_KEY_CACHE_DIR'];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyService,
        {
          provide: AsymmetricService,
          useValue: {
            generateKeyPair: jest.fn().mockResolvedValue({
              private: 'privateKey',
              public: 'publicKey',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<KeyService>(KeyService);
    asymmetricService = module.get<AsymmetricService>(AsymmetricService);

    // Clear mocks before each test
    (fsPromises.writeFile as jest.Mock).mockClear();
    (fs.existsSync as jest.Mock).mockClear();
    (fs.mkdirSync as jest.Mock).mockClear();

    // Set mock implementations
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {
      // Mock implementation of mkdirSync
      console.log('Mocked mkdirSync called');
    });
    (fsPromises.writeFile as jest.Mock).mockResolvedValue(undefined);
    delete process.env['AUTH_KEY_CACHE_DIR'];
  });

  afterAll(() => {
    if (originalAuthKeyCacheDir === undefined) {
      delete process.env['AUTH_KEY_CACHE_DIR'];
      return;
    }

    process.env['AUTH_KEY_CACHE_DIR'] = originalAuthKeyCacheDir;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate user keys', async () => {
    const userId = 'test-user';
    const hash = 'test-hash';
    const expectedCacheDir = join(tmpdir(), 'ot-auth-keys');

    const result = await service.generateUserKeys(userId, hash);

    expect(asymmetricService.generateKeyPair).toHaveBeenCalledWith(hash);
    expect(fs.existsSync).toHaveBeenCalledWith(expectedCacheDir);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedCacheDir, {
      recursive: true,
    });
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      join(expectedCacheDir, `${userId}.priv`),
      'privateKey',
      'utf-8'
    );
    expect(result).toEqual({
      pubKey: 'publicKey',
      privLocation: join(expectedCacheDir, `${userId}.priv`),
    });
  });

  it('should not create directory if it exists', async () => {
    const userId = 'test-user';
    const hash = 'test-hash';

    (fs.existsSync as jest.Mock).mockReturnValue(true);

    await service.generateUserKeys(userId, hash);

    expect(fs.existsSync).toHaveBeenCalledWith(join(tmpdir(), 'ot-auth-keys'));
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('should use an explicit cache directory when configured', async () => {
    const userId = 'test-user';
    const hash = 'test-hash';
    process.env['AUTH_KEY_CACHE_DIR'] = '/tmp/custom-auth-key-cache';

    await service.generateUserKeys(userId, hash);

    expect(fs.existsSync).toHaveBeenCalledWith('/tmp/custom-auth-key-cache');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/custom-auth-key-cache', {
      recursive: true,
    });
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      '/tmp/custom-auth-key-cache/test-user.priv',
      'privateKey',
      'utf-8'
    );
  });

  it('should throw an error if key generation fails', async () => {
    const userId = 'test-user';
    const hash = 'test-hash';
    jest
      .spyOn(asymmetricService, 'generateKeyPair')
      .mockRejectedValue(new Error('test error'));

    await expect(service.generateUserKeys(userId, hash)).rejects.toThrow(
      'Failed to generate keys for user test-user'
    );
  });
});
