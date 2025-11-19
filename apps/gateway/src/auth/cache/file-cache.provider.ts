import { Injectable, Logger } from '@nestjs/common';
import { ICacheProvider, CacheStats } from './cache-provider.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

interface CacheEntry {
  value: boolean;
  timestamp: number;
}

/**
 * File-based cache provider for permission checks
 * Persists across restarts but slower than memory cache
 * Best for single-instance deployments that need persistence
 */
@Injectable()
export class FileCacheProvider implements ICacheProvider {
  private readonly logger = new Logger(FileCacheProvider.name);
  private readonly cacheDir: string;
  private readonly cacheTTL: number;
  private readonly maxCacheSize: number;
  private hits = 0;
  private misses = 0;
  private cacheIndex: Map<string, string> = new Map(); // key -> filename mapping

  constructor(
    cacheDir = '/tmp/permissions-cache',
    ttl = 5 * 60 * 1000,
    maxSize = 10000
  ) {
    this.cacheDir = cacheDir;
    this.cacheTTL = ttl;
    this.maxCacheSize = maxSize;
    this.initCacheDir();
    this.logger.log(
      `FileCacheProvider initialized with dir=${cacheDir}, TTL=${ttl}ms, maxSize=${maxSize}`
    );
  }

  private async initCacheDir(): Promise<void> {
    try {
      if (!existsSync(this.cacheDir)) {
        await fs.mkdir(this.cacheDir, { recursive: true });
        this.logger.log(`Created cache directory: ${this.cacheDir}`);
      }
      await this.buildIndex();
    } catch (error) {
      this.logger.error(`Failed to initialize cache directory: ${error.message}`);
    }
  }

  private async buildIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = Buffer.from(file.replace('.json', ''), 'hex').toString(
            'utf8'
          );
          this.cacheIndex.set(key, file);
        }
      }
      this.logger.debug(`Built cache index with ${this.cacheIndex.size} entries`);
    } catch (error) {
      this.logger.error(`Failed to build cache index: ${error.message}`);
    }
  }

  private getFilePath(key: string): string {
    // Use hex encoding for safe filenames
    const filename = Buffer.from(key).toString('hex') + '.json';
    return path.join(this.cacheDir, filename);
  }

  async get(key: string): Promise<boolean | null> {
    try {
      const filePath = this.getFilePath(key);
      
      if (!existsSync(filePath)) {
        this.misses++;
        this.logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const entry: CacheEntry = JSON.parse(content);

      const now = Date.now();
      const age = now - entry.timestamp;

      if (age > this.cacheTTL) {
        this.misses++;
        this.logger.debug(`Cache entry expired for key: ${key} (age: ${age}ms)`);
        await this.delete(key);
        return null;
      }

      this.hits++;
      this.logger.debug(`Cache hit for key: ${key}`);
      return entry.value;
    } catch (error) {
      this.misses++;
      this.logger.error(`Error reading cache for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: boolean, ttl?: number): Promise<void> {
    try {
      // Check cache size and evict oldest if needed
      if (this.cacheIndex.size >= this.maxCacheSize) {
        await this.evictOldest();
      }

      const entry: CacheEntry = {
        value,
        timestamp: Date.now(),
      };

      const filePath = this.getFilePath(key);
      await fs.writeFile(filePath, JSON.stringify(entry), 'utf8');
      
      const filename = path.basename(filePath);
      this.cacheIndex.set(key, filename);

      this.logger.debug(`Cached value for key: ${key} = ${value}`);
    } catch (error) {
      this.logger.error(`Error writing cache for key ${key}: ${error.message}`);
    }
  }

  private async evictOldest(): Promise<void> {
    try {
      // Find oldest file by modification time
      const files = await fs.readdir(this.cacheDir);
      if (files.length === 0) return;

      let oldestFile = '';
      let oldestTime = Date.now();

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < oldestTime) {
          oldestTime = stats.mtimeMs;
          oldestFile = file;
        }
      }

      if (oldestFile) {
        const filePath = path.join(this.cacheDir, oldestFile);
        await fs.unlink(filePath);
        
        // Remove from index
        for (const [key, filename] of this.cacheIndex.entries()) {
          if (filename === oldestFile) {
            this.cacheIndex.delete(key);
            break;
          }
        }
        
        this.logger.debug(`Cache full, evicted oldest entry: ${oldestFile}`);
      }
    } catch (error) {
      this.logger.error(`Error evicting oldest entry: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
        this.cacheIndex.delete(key);
        this.logger.debug(`Deleted cache entry: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting cache for key ${key}: ${error.message}`);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    for (const key of Array.from(this.cacheIndex.keys())) {
      if (regex.test(key)) {
        await this.delete(key);
        count++;
      }
    }

    this.logger.log(`Deleted ${count} cache entries matching pattern: ${pattern}`);
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let count = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          await fs.unlink(filePath);
          count++;
        }
      }

      this.cacheIndex.clear();
      this.hits = 0;
      this.misses = 0;
      this.logger.log(`Cleared all ${count} cache entries`);
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
    }
  }

  async getStats(): Promise<CacheStats> {
    return {
      size: this.cacheIndex.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTTL,
      provider: 'file',
      hits: this.hits,
      misses: this.misses,
    };
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    let count = 0;

    try {
      for (const key of Array.from(this.cacheIndex.keys())) {
        const filePath = this.getFilePath(key);
        
        if (existsSync(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(content);
          const age = now - entry.timestamp;

          if (age > this.cacheTTL) {
            await this.delete(key);
            count++;
          }
        }
      }

      if (count > 0) {
        this.logger.debug(`Cleaned up ${count} expired cache entries`);
      }
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error.message}`);
    }
  }
}
