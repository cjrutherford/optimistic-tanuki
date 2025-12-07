import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FileCacheProvider } from './file-cache.provider';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

jest.mock('fs/promises');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
}));

describe('FileCacheProvider', () => {
  let provider: FileCacheProvider;
  let logger: Logger;
  const cacheDir = '/tmp/permissions-cache-test';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: FileCacheProvider,
          useFactory: () => new FileCacheProvider(cacheDir, 5000, 3),
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<FileCacheProvider>(FileCacheProvider);
    logger = module.get<Logger>(Logger);
    (fs.mkdir as jest.Mock).mockClear();
    (fs.readdir as jest.Mock).mockClear().mockResolvedValue([]);
    (fs.readFile as jest.Mock).mockClear();
    (fs.writeFile as jest.Mock).mockClear();
    (fs.unlink as jest.Mock).mockClear();
    (fs.stat as jest.Mock).mockClear();
    (existsSync as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('get and set', () => {
    it('should return null for non-existent key', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const result = await provider.get('test-key');
      expect(result).toBeNull();
    });

    it('should cache and retrieve a value', async () => {
      await provider.set('test-key', true);
      (existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ value: true, timestamp: Date.now() }));
      const result = await provider.get('test-key');
      expect(result).toBe(true);
    });

    it('should return null for expired key', async () => {
      await provider.set('test-key', true);
      (existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ value: true, timestamp: Date.now() - 10000 }));
      const result = await provider.get('test-key');
      expect(result).toBeNull();
    });

    it('should evict oldest entry when cache is full', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['key1.json', 'key2.json', 'key3.json']);
      (fs.stat as jest.Mock).mockImplementation(async (path: string) => {
        if (path.includes('key1')) return { mtimeMs: Date.now() - 3000 };
        if (path.includes('key2')) return { mtimeMs: Date.now() - 2000 };
        if (path.includes('key3')) return { mtimeMs: Date.now() - 1000 };
        return { mtimeMs: Date.now() };
      });

      await provider.set('key1', true);
      await provider.set('key2', true);
      await provider.set('key3', true);
      await provider.set('key4', true);

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('key1.json'));
    });
  });

  describe('delete', () => {
    it('should delete a cache entry', async () => {
        await provider.set('test-key', true);
      (fs.readdir as jest.Mock).mockResolvedValue(['746573742d6b65792e6a736f6e.json']);
      (existsSync as jest.Mock).mockReturnValue(true);
      await provider.delete('test-key');
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
        await provider.set('test-key', true);
        (fs.readdir as jest.Mock).mockResolvedValue(['key1.json', 'key2.json']);
      await provider.clear();
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should log an error if reading a cache file fails', async () => {
      const spy = jest.spyOn(provider['logger'], 'error');
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      const result = await provider.get('test-key');
      
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledWith('Error reading cache for key test-key: Read error');
    });

    it('should log an error if writing a cache file fails', async () => {
      const spy = jest.spyOn(provider['logger'], 'error');
        (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write error'));
        
        await provider.set('test-key', true);
        
        expect(spy).toHaveBeenCalledWith('Error writing cache for key test-key: Write error');
    });

    it('should log an error if deleting a cache file fails', async () => {
      const spy = jest.spyOn(provider['logger'], 'error');
        (existsSync as jest.Mock).mockReturnValue(true);
        (fs.unlink as jest.Mock).mockRejectedValue(new Error('Delete error'));
        
        await provider.delete('test-key');
        
        expect(spy).toHaveBeenCalledWith('Error deleting cache for key test-key: Delete error');
    });

    it('should log an error if clearing the cache fails', async () => {
      const spy = jest.spyOn(provider['logger'], 'error');
        (fs.readdir as jest.Mock).mockResolvedValue(['key1.json']);
        (fs.unlink as jest.Mock).mockRejectedValue(new Error('Clear error'));
        
        await provider.clear();
        
        expect(spy).toHaveBeenCalledWith('Error clearing cache: Clear error');
    });
  });
});