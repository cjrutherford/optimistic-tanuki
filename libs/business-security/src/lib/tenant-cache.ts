import { TenantContext } from './tenant-resolution.types';

export interface ITenantCache {
  get(key: string): Promise<TenantContext | null> | TenantContext | null;
  set(key: string, value: TenantContext, ttlMs?: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

interface CacheEntry {
  value: TenantContext;
  expiresAt: number;
}

export class MemoryTenantCache implements ITenantCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs = 300000, maxSize = 5000) {
    this.defaultTtlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): TenantContext | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: TenantContext, ttlMs?: number): void {
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    const ttl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class RedisTenantCache implements ITenantCache {
  constructor(
    private readonly redisClient: {
      get(key: string): Promise<string | null>;
      set(
        key: string,
        value: string,
        mode?: string,
        duration?: number
      ): Promise<unknown>;
      del(key: string): Promise<number>;
      flushdb?(): Promise<string>;
    },
    private readonly keyPrefix = 'tenant:cache:',
    private readonly defaultTtlSeconds = 300
  ) {}

  async get(key: string): Promise<TenantContext | null> {
    try {
      const raw = await this.redisClient.get(`${this.keyPrefix}${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as TenantContext;
    } catch {
      return null;
    }
  }

  async set(key: string, value: TenantContext, ttlMs?: number): Promise<void> {
    try {
      const seconds = ttlMs ? Math.ceil(ttlMs / 1000) : this.defaultTtlSeconds;
      await this.redisClient.set(
        `${this.keyPrefix}${key}`,
        JSON.stringify(value),
        'EX',
        seconds
      );
    } catch {
      // Degrade gracefully if redis communication fails
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(`${this.keyPrefix}${key}`);
    } catch {
      // Degrade gracefully
    }
  }

  async clear(): Promise<void> {
    // No-op or specific key scan deletion
  }
}
