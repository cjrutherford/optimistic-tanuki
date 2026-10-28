import {
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { createHash } from 'node:crypto';
import { OAUTH_ACCOUNT_CLEANUP_SCRIPT } from './oauth-deletion.scripts';

export type StoredOAuthState = {
  payload: {
    provider: string;
    returnTo: string;
    appScope: string;
    issuedAt: number;
    codeVerifier: string;
    cookieSession?: boolean;
    linkUserId?: string;
    /** Server-validated registration context; never placed in provider URLs. */
    ageEligibilityStatus?: 'adult';
    /** False permits existing-account authentication only, never account bootstrap. */
    registrationAllowed?: boolean;
    guardianResumeToken?: string;
    guardianApplicantEmail?: string;
  };
  nonceHash: string;
  expiresAt: number;
};

export type StoredOAuthCallbackGrant = {
  sessionId: string;
  userId: string;
  profileId: string;
  appId: string;
  returnOrigin: string;
  redemptionOrigin: string;
  cookieSession?: boolean;
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
    redemptionOrigin: string,
    stateId: string,
    nonceHash: string
  ): Promise<StoredOAuthCallbackGrant | undefined>;
  invalidateAccount(accountId: string): Promise<void>;
  /** Trusted deletion coordinator only; permanently fences this account in this store. */
  purgeAccount(accountId: string): Promise<{ remaining: 0 }>;
  readbackAccount(accountId: string): Promise<number>;
}

const validUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const accountFenceKey = (accountId: string): string => {
  if (!validUUID(accountId))
    throw new HttpException('Invalid account id', HttpStatus.BAD_REQUEST);
  return createHash('sha256')
    .update(`ot:oauth-deletion:${accountId.toLowerCase()}`)
    .digest('hex');
};

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
  private readonly deletedAccounts = new Set<string>();

  async create(stateId: string, state: StoredOAuthState): Promise<void> {
    this.prune();
    if (state.payload.linkUserId)
      this.assertAccountActive(state.payload.linkUserId);
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
    if (
      !validUUID(grant.sessionId) ||
      !validUUID(grant.userId) ||
      !validUUID(grant.profileId) ||
      typeof grant.appId !== 'string' ||
      'token' in (grant as any)
    )
      throw new HttpException(
        'Invalid OAuth callback grant',
        HttpStatus.BAD_REQUEST
      );
    this.assertAccountActive(grant.userId);
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
    redemptionOrigin: string,
    stateId: string,
    nonceHash: string
  ): Promise<StoredOAuthCallbackGrant | undefined> {
    const grant = this.callbackGrants.get(code);
    if (!grant || grant.expiresAt <= Date.now() || !isReferenceGrant(grant)) {
      this.callbackGrants.delete(code);
      return undefined;
    }
    if (
      // The callback proxy is the normal redemption origin, but a popup
      // opener may redeem on its own host so the HttpOnly cookie is scoped to
      // the application that initiated sign-in.
      (grant.redemptionOrigin !== redemptionOrigin &&
        grant.returnOrigin !== redemptionOrigin) ||
      grant.stateId !== stateId ||
      grant.nonceHash !== nonceHash
    )
      return undefined;
    this.callbackGrants.delete(code);
    if (!isReferenceGrant(grant)) return undefined;
    return grant;
  }

  async invalidateAccount(accountId: string): Promise<void> {
    if (!validUUID(accountId))
      throw new HttpException('Invalid account id', HttpStatus.BAD_REQUEST);
    accountId = accountId.toLowerCase();
    for (const [id, state] of this.states) {
      if (state.payload.linkUserId?.toLowerCase() === accountId)
        this.states.delete(id);
    }
    for (const [code, grant] of this.callbackGrants) {
      if (grant.userId?.toLowerCase() === accountId)
        this.callbackGrants.delete(code);
    }
  }

  async purgeAccount(accountId: string): Promise<{ remaining: 0 }> {
    const key = accountFenceKey(accountId);
    if (
      !this.deletedAccounts.has(key) &&
      this.deletedAccounts.size >= this.maxSize
    )
      throw new Error('OAUTH_DELETION_FENCE_LIMIT');
    this.deletedAccounts.add(key);
    await this.invalidateAccount(accountId);
    if ((await this.readbackAccount(accountId)) !== 0)
      throw new Error('OAUTH_DELETION_READBACK');
    return { remaining: 0 };
  }

  async readbackAccount(accountId: string): Promise<number> {
    if (!this.deletedAccounts.has(accountFenceKey(accountId)))
      throw new Error('OAUTH_DELETION_FENCE_REQUIRED');
    const id = accountId.toLowerCase();
    return (
      [...this.states.values()].filter(
        (s) => s.payload.linkUserId?.toLowerCase() === id
      ).length +
      [...this.callbackGrants.values()].filter(
        (g) => g.userId.toLowerCase() === id
      ).length
    );
  }

  private assertAccountActive(accountId: string): void {
    if (this.deletedAccounts.has(accountFenceKey(accountId)))
      throw new Error('OAUTH_ACCOUNT_DELETION_FENCED');
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
  private readonly grantIndexKey = 'gateway:oauth-callback-grant:index';
  private readonly deletionFenceKey = 'gateway:oauth-deletion:fences';
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
      "if ARGV[8] ~= '' and redis.call('HEXISTS', KEYS[3], ARGV[8]) == 1 then return -1 end; redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1]); if redis.call('ZCARD', KEYS[1])>=tonumber(ARGV[4]) then return 0 end; redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3]); redis.call('PEXPIRE', KEYS[1], ARGV[5]); redis.call('PSETEX', KEYS[2], ARGV[6], ARGV[7]); return 1",
      '3',
      this.indexKey,
      `${this.prefix}${stateId}`,
      this.deletionFenceKey,
      String(Date.now()),
      String(state.expiresAt),
      stateId,
      String(this.maxSize),
      String(this.ttlMs),
      String(ttl),
      JSON.stringify(state),
      state.payload.linkUserId ? accountFenceKey(state.payload.linkUserId) : '',
    ]);
    if (Number(result) === -1) throw new Error('OAUTH_ACCOUNT_DELETION_FENCED');
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
    if (!isReferenceGrant(grant))
      throw new HttpException(
        'Invalid OAuth callback grant',
        HttpStatus.BAD_REQUEST
      );
    this.requireConnection();
    const ttl = Math.max(1, grant.expiresAt - Date.now());
    const result = await this.client.sendCommand([
      'EVAL',
      "if ARGV[8] ~= '' and redis.call('HEXISTS', KEYS[3], ARGV[8]) == 1 then return -1 end; redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1]); if redis.call('ZCARD', KEYS[1])>=tonumber(ARGV[4]) then return 0 end; redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3]); redis.call('PEXPIRE', KEYS[1], ARGV[5]); redis.call('PSETEX', KEYS[2], ARGV[6], ARGV[7]); return 1",
      '3',
      this.grantIndexKey,
      `${this.callbackGrantPrefix}${code}`,
      this.deletionFenceKey,
      String(Date.now()),
      String(grant.expiresAt),
      code,
      String(this.maxSize),
      String(this.ttlMs),
      String(ttl),
      JSON.stringify(grant),
      accountFenceKey(grant.userId),
    ]);
    if (Number(result) === -1) throw new Error('OAUTH_ACCOUNT_DELETION_FENCED');
    if (Number(result) !== 1)
      throw new HttpException(
        'OAuth is temporarily busy',
        HttpStatus.TOO_MANY_REQUESTS
      );
  }

  async consumeCallbackGrant(
    code: string,
    redemptionOrigin: string,
    stateId: string,
    nonceHash: string
  ): Promise<StoredOAuthCallbackGrant | undefined> {
    this.requireConnection();
    await this.client.sendCommand([
      'ZREMRANGEBYSCORE',
      this.grantIndexKey,
      '-inf',
      String(Date.now()),
    ]);
    const value = await this.client.sendCommand([
      'EVAL',
      "local value=redis.call('GET', KEYS[1]); if not value then return nil end; local grant=cjson.decode(value); if (grant.redemptionOrigin ~= ARGV[1] and grant.returnOrigin ~= ARGV[1]) or grant.stateId ~= ARGV[2] or grant.nonceHash ~= ARGV[3] then return nil end; redis.call('DEL', KEYS[1]); redis.call('ZREM', KEYS[2], ARGV[4]); return value",
      '2',
      `${this.callbackGrantPrefix}${code}`,
      this.grantIndexKey,
      redemptionOrigin,
      stateId,
      nonceHash,
      code,
    ]);
    if (typeof value !== 'string') return undefined;
    try {
      const grant = JSON.parse(value) as StoredOAuthCallbackGrant;
      return isReferenceGrant(grant) ? grant : undefined;
    } catch {
      return undefined;
    }
  }

  async invalidateAccount(accountId: string): Promise<void> {
    if (!validUUID(accountId))
      throw new HttpException('Invalid account id', HttpStatus.BAD_REQUEST);
    accountId = accountId.toLowerCase();
    this.requireConnection();
    // Redis indices are bounded to maxSize by atomic insertion scripts.
    await this.client.sendCommand([
      'EVAL',
      "local states=redis.call('ZRANGE', KEYS[1], 0, -1); for _,id in ipairs(states) do local key=ARGV[1]..id; local value=redis.call('GET',key); if value then local ok,state=pcall(cjson.decode,value); if ok and state.payload and state.payload.linkUserId==ARGV[3] then redis.call('DEL',key); redis.call('ZREM',KEYS[1],id) end end end; local grants=redis.call('ZRANGE',KEYS[2],0,-1); for _,code in ipairs(grants) do local key=ARGV[2]..code; local value=redis.call('GET',key); if value then local ok,grant=pcall(cjson.decode,value); if ok and grant.userId==ARGV[3] then redis.call('DEL',key); redis.call('ZREM',KEYS[2],code) end end end; return 1",
      '2',
      this.indexKey,
      this.grantIndexKey,
      this.prefix,
      this.callbackGrantPrefix,
      accountId,
    ]);
  }

  async purgeAccount(accountId: string): Promise<{ remaining: 0 }> {
    await this.accountCleanup(accountId, 'purge');
    if ((await this.readbackAccount(accountId)) !== 0)
      throw new Error('OAUTH_DELETION_READBACK');
    return { remaining: 0 };
  }

  async readbackAccount(accountId: string): Promise<number> {
    return this.accountCleanup(accountId, 'readback');
  }

  private async accountCleanup(
    accountId: string,
    mode: 'purge' | 'readback'
  ): Promise<number> {
    const key = accountFenceKey(accountId);
    this.requireConnection();
    const result = await this.client.sendCommand([
      'EVAL',
      OAUTH_ACCOUNT_CLEANUP_SCRIPT,
      '3',
      this.indexKey,
      this.grantIndexKey,
      this.deletionFenceKey,
      this.prefix,
      this.callbackGrantPrefix,
      accountId.toLowerCase(),
      key,
      String(this.maxSize),
      mode,
    ]);
    // Negative statuses include malformed data, missing fence and exhausted bounds.
    if (
      typeof result !== 'number' ||
      !Number.isSafeInteger(result) ||
      result < 0
    )
      throw new Error('OAUTH_DELETION_UNVERIFIED');
    return result;
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

const isReferenceGrant = (
  grant: unknown
): grant is StoredOAuthCallbackGrant => {
  if (!grant || typeof grant !== 'object') return false;
  const value = grant as Record<string, unknown>;
  return (
    validUUID(value.sessionId) &&
    validUUID(value.userId) &&
    validUUID(value.profileId) &&
    typeof value.appId === 'string' &&
    typeof value.returnOrigin === 'string' &&
    typeof value.redemptionOrigin === 'string' &&
    typeof value.stateId === 'string' &&
    typeof value.nonceHash === 'string' &&
    typeof value.expiresAt === 'number' &&
    !('token' in value)
  );
};
