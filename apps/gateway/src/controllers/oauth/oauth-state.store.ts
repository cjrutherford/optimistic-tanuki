import {
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

export type StoredOAuthState = {
  payload: {
    provider: string;
    returnTo: string;
    appScope: string;
    issuedAt: number;
    linkUserId?: string;
  };
  nonceHash: string;
  expiresAt: number;
};

export type StoredOAuthCallbackGrant = {
  token: string;
  returnOrigin: string;
  stateId: string;
  nonceHash: string;
  expiresAt: number;
};

export interface OAuthStateStore {
  create(stateId: string, state: StoredOAuthState): Promise<void>;
  consume(stateId: string): Promise<StoredOAuthState | undefined>;
  createCallbackGrant(
    code: string,
    grant: StoredOAuthCallbackGrant
  ): Promise<void>;
  consumeCallbackGrant(
    code: string,
    returnOrigin: string,
    stateId: string,
    nonceHash: string
  ): Promise<StoredOAuthCallbackGrant | undefined>;
}

export const OAUTH_STATE_STORE = Symbol('OAUTH_STATE_STORE');

type OAuthStateEnvironment = NodeJS.ProcessEnv & {
  NODE_ENV?: string;
  OAUTH_STATE_SECRET?: string;
  OAUTH_STATE_STORE?: string;
  REDIS_HOST?: string;
};

export const assertOAuthStateEnvironment = (
  environment: OAuthStateEnvironment = process.env
): void => {
  if (!environment.OAUTH_STATE_SECRET?.trim()) {
    throw new Error('OAUTH_STATE_SECRET is required');
  }

  selectOAuthStateStore(environment);
};

export const selectOAuthStateStore = (
  environment: OAuthStateEnvironment = process.env
): 'local' | 'redis' => {
  if (!environment.OAUTH_STATE_SECRET?.trim()) {
    throw new Error('OAUTH_STATE_SECRET is required');
  }

  const nodeEnvironment = environment.NODE_ENV?.trim();
  const localStoreRequested = environment.OAUTH_STATE_STORE === 'local';
  const localStoreAllowed =
    nodeEnvironment === 'development' || nodeEnvironment === 'test';

  if (localStoreRequested && !localStoreAllowed) {
    throw new Error(
      'OAUTH_STATE_STORE=local is only permitted in development or test'
    );
  }

  if (localStoreRequested || localStoreAllowed) {
    return 'local';
  }

  if (!environment.REDIS_HOST?.trim()) {
    throw new Error('REDIS_HOST is required for the OAuth state store');
  }

  return 'redis';
};

/**
 * A process-local store is deliberately restricted to development/test. OAuth
 * state must be shared by all gateway replicas in production.
 */
export class LocalOAuthStateStore implements OAuthStateStore {
  private readonly states = new Map<string, StoredOAuthState>();
  private readonly callbackGrants = new Map<string, StoredOAuthCallbackGrant>();
  private readonly maxSize = 10_000;

  async create(stateId: string, state: StoredOAuthState): Promise<void> {
    this.prune();
    if (this.states.size >= this.maxSize) {
      throw new HttpException(
        'OAuth is temporarily busy',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    this.states.set(stateId, state);
  }

  async consume(stateId: string): Promise<StoredOAuthState | undefined> {
    const state = this.states.get(stateId);
    this.states.delete(stateId);
    if (!state || state.expiresAt <= Date.now()) return undefined;
    return state;
  }

  async createCallbackGrant(
    code: string,
    grant: StoredOAuthCallbackGrant
  ): Promise<void> {
    this.prune();
    if (this.callbackGrants.size >= this.maxSize) {
      throw new HttpException(
        'OAuth is temporarily busy',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    this.callbackGrants.set(code, grant);
  }

  async consumeCallbackGrant(
    code: string,
    returnOrigin: string,
    stateId: string,
    nonceHash: string
  ): Promise<StoredOAuthCallbackGrant | undefined> {
    const grant = this.callbackGrants.get(code);
    if (!grant || grant.expiresAt <= Date.now()) {
      this.callbackGrants.delete(code);
      return undefined;
    }
    if (
      grant.returnOrigin !== returnOrigin ||
      grant.stateId !== stateId ||
      grant.nonceHash !== nonceHash
    )
      return undefined;
    this.callbackGrants.delete(code);
    return grant;
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, state] of this.states) {
      if (state.expiresAt <= now) this.states.delete(id);
    }
    for (const [code, grant] of this.callbackGrants) {
      if (grant.expiresAt <= now) this.callbackGrants.delete(code);
    }
  }
}

export class RedisOAuthStateStore implements OAuthStateStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisOAuthStateStore.name);
  private readonly client: RedisClientType;
  private connected = false;
  private readonly prefix = 'gateway:oauth-state:';
  private readonly callbackGrantPrefix = 'gateway:oauth-callback-grant:';
  private readonly indexKey = 'gateway:oauth-state:index';
  private readonly ttlMs = 10 * 60 * 1000;
  private readonly maxSize = 10_000;

  constructor(host: string, port: number, password?: string, db = 0) {
    this.client = createClient({
      socket: { host, port },
      password,
      database: db,
    }) as RedisClientType;
    this.client.on('error', (error) => {
      this.connected = false;
      this.logger.error(`OAuth state Redis error: ${error.message}`);
    });
    this.client.on('ready', () => {
      this.connected = true;
    });
    this.client
      .connect()
      .catch((error) =>
        this.logger.error(
          `OAuth state Redis connection failed: ${error.message}`
        )
      );
  }

  async create(stateId: string, state: StoredOAuthState): Promise<void> {
    this.requireConnection();
    const ttl = Math.max(1, state.expiresAt - Date.now());
    // Capacity is reserved atomically after expired index entries are removed.
    // Existing states are never evicted to make room for a new request.
    const result = await this.client.sendCommand([
      'EVAL',
      "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1]); if redis.call('ZCARD', KEYS[1])>=tonumber(ARGV[4]) then return 0 end; redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3]); redis.call('PEXPIRE', KEYS[1], ARGV[5]); redis.call('PSETEX', KEYS[2], ARGV[6], ARGV[7]); return 1",
      '2',
      this.indexKey,
      `${this.prefix}${stateId}`,
      String(Date.now()),
      String(state.expiresAt),
      stateId,
      String(this.maxSize),
      String(this.ttlMs),
      String(ttl),
      JSON.stringify(state),
    ]);
    if (Number(result) !== 1) {
      throw new HttpException(
        'OAuth is temporarily busy',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  async consume(stateId: string): Promise<StoredOAuthState | undefined> {
    this.requireConnection();
    // GETDEL is atomic, so concurrent callbacks cannot both consume state.
    const value = await this.client.sendCommand([
      'EVAL',
      "local value=redis.call('GETDEL', KEYS[1]); redis.call('ZREM', KEYS[2], ARGV[1]); return value",
      '2',
      `${this.prefix}${stateId}`,
      this.indexKey,
      stateId,
    ]);
    if (typeof value !== 'string') return undefined;
    try {
      return JSON.parse(value) as StoredOAuthState;
    } catch {
      return undefined;
    }
  }

  async createCallbackGrant(
    code: string,
    grant: StoredOAuthCallbackGrant
  ): Promise<void> {
    this.requireConnection();
    const ttl = Math.max(1, grant.expiresAt - Date.now());
    await this.client.set(
      `${this.callbackGrantPrefix}${code}`,
      JSON.stringify(grant),
      { PX: ttl }
    );
  }

  async consumeCallbackGrant(
    code: string,
    returnOrigin: string,
    stateId: string,
    nonceHash: string
  ): Promise<StoredOAuthCallbackGrant | undefined> {
    this.requireConnection();
    const value = await this.client.sendCommand([
      'EVAL',
      "local value=redis.call('GET', KEYS[1]); if not value then return nil end; local grant=cjson.decode(value); if grant.returnOrigin ~= ARGV[1] or grant.stateId ~= ARGV[2] or grant.nonceHash ~= ARGV[3] then return nil end; redis.call('DEL', KEYS[1]); return value",
      '1',
      `${this.callbackGrantPrefix}${code}`,
      returnOrigin,
      stateId,
      nonceHash,
    ]);
    if (typeof value !== 'string') return undefined;
    try {
      return JSON.parse(value) as StoredOAuthCallbackGrant;
    } catch {
      return undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  private requireConnection(): void {
    if (!this.connected) {
      throw new HttpException(
        'OAuth is temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
