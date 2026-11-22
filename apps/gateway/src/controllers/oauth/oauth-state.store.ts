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

export type PendingOAuthKind = 'link_account' | 'age_verification';

/**
 * A callback that cannot finish in one pass (link confirmation or age check).
 * Holds the provider identity only; nothing from the provider token.
 */
export type StoredPendingOAuthIntent = {
  kind: PendingOAuthKind;
  provider: string;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  firstName: string;
  lastName: string;
  appScope: string;
  returnTo: string;
  cookieSession?: boolean;
  /** Link intents only: the local account the provider email matched. */
  userId?: string;
  hasPassword?: boolean;
  /** Same binding as callback grants: state id and hash of the nonce cookie. */
  stateId: string;
  nonceHash: string;
  expiresAt: number;
};

export type PendingOAuthBinding = { stateId: string; nonceHash: string };
export type PendingOAuthLinkCode = { codeHash: string; expiresAt: number };

export interface OAuthStateStore {
  createPendingIntent(
    code: string,
    intent: StoredPendingOAuthIntent
  ): Promise<void>;
  /** Reads without consuming. Undefined unless the nonce binding matches. */
  getPendingIntent(
    code: string,
    binding: PendingOAuthBinding
  ): Promise<StoredPendingOAuthIntent | undefined>;
  /** Single use: atomically returns and deletes a bound intent. */
  consumePendingIntent(
    code: string,
    binding: PendingOAuthBinding
  ): Promise<StoredPendingOAuthIntent | undefined>;
  /**
   * Counts a failed attempt. Returns the attempts used, deleting the intent
   * once `max` is reached, or undefined when no bound intent exists.
   */
  recordPendingAttempt(
    code: string,
    binding: PendingOAuthBinding,
    max: number
  ): Promise<number | undefined>;
  setPendingLinkCode(
    code: string,
    binding: PendingOAuthBinding,
    linkCode: PendingOAuthLinkCode
  ): Promise<boolean>;
  getPendingLinkCode(
    code: string,
    binding: PendingOAuthBinding
  ): Promise<PendingOAuthLinkCode | undefined>;
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

const isPendingIntent = (value: unknown): value is StoredPendingOAuthIntent => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v['kind'] === 'link_account' || v['kind'] === 'age_verification') &&
    typeof v['provider'] === 'string' &&
    typeof v['providerUserId'] === 'string' &&
    typeof v['email'] === 'string' &&
    typeof v['appScope'] === 'string' &&
    typeof v['returnTo'] === 'string' &&
    typeof v['stateId'] === 'string' &&
    typeof v['nonceHash'] === 'string' &&
    typeof v['expiresAt'] === 'number' &&
    !('token' in v) &&
    !('accessToken' in v)
  );
};

const bindingMatches = (
  intent: StoredPendingOAuthIntent,
  binding: PendingOAuthBinding
): boolean =>
  intent.stateId === binding.stateId && intent.nonceHash === binding.nonceHash;

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
  private readonly pending = new Map<
    string,
    {
      intent: StoredPendingOAuthIntent;
      attempts: number;
      linkCode?: PendingOAuthLinkCode;
    }
  >();

  async createPendingIntent(
    code: string,
    intent: StoredPendingOAuthIntent
  ): Promise<void> {
    this.prune();
    if (!isPendingIntent(intent))
      throw new HttpException(
        'Invalid pending OAuth intent',
        HttpStatus.BAD_REQUEST
      );
    if (intent.userId) this.assertAccountActive(intent.userId);
    if (this.pending.size >= this.maxSize)
      throw new HttpException(
        'OAuth is temporarily busy',
        HttpStatus.TOO_MANY_REQUESTS
      );
    this.pending.set(code, { intent, attempts: 0 });
  }

  private boundPending(code: string, binding: PendingOAuthBinding) {
    const entry = this.pending.get(code);
    if (!entry) return undefined;
    if (entry.intent.expiresAt <= Date.now()) {
      this.pending.delete(code);
      return undefined;
    }
    return bindingMatches(entry.intent, binding) ? entry : undefined;
  }

  async getPendingIntent(code: string, binding: PendingOAuthBinding) {
    return this.boundPending(code, binding)?.intent;
  }

  async consumePendingIntent(code: string, binding: PendingOAuthBinding) {
    const entry = this.boundPending(code, binding);
    if (!entry) return undefined;
    this.pending.delete(code);
    return entry.intent;
  }

  async recordPendingAttempt(
    code: string,
    binding: PendingOAuthBinding,
    max: number
  ) {
    const entry = this.boundPending(code, binding);
    if (!entry) return undefined;
    entry.attempts += 1;
    if (entry.attempts >= max) this.pending.delete(code);
    return entry.attempts;
  }

  async setPendingLinkCode(
    code: string,
    binding: PendingOAuthBinding,
    linkCode: PendingOAuthLinkCode
  ) {
    const entry = this.boundPending(code, binding);
    if (!entry) return false;
    entry.linkCode = linkCode;
    return true;
  }

  async getPendingLinkCode(code: string, binding: PendingOAuthBinding) {
    return this.boundPending(code, binding)?.linkCode;
  }

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
    for (const [code, entry] of this.pending) {
      if (entry.intent.userId?.toLowerCase() === accountId)
        this.pending.delete(code);
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
      ).length +
      [...this.pending.values()].filter(
        (e) => e.intent.userId?.toLowerCase() === id
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
    for (const [code, entry] of this.pending) {
      if (entry.intent.expiresAt <= now) this.pending.delete(code);
    }
  }
}

/**
 * KEYS: intent key, fence hash, per-account set. ARGV: json, ttl ms, fence
 * field ('' for intents without an account), intent id. Returns -1 when fenced.
 */
const PENDING_CREATE_SCRIPT = `
if ARGV[3] ~= '' and redis.call('HEXISTS', KEYS[2], ARGV[3]) == 1 then return -1 end
if not redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX') then return 0 end
if ARGV[3] ~= '' then
  redis.call('SADD', KEYS[3], ARGV[4])
  if redis.call('PTTL', KEYS[3]) < tonumber(ARGV[2]) then
    redis.call('PEXPIRE', KEYS[3], ARGV[2])
  end
end
return 1
`;

/** KEYS: per-account set. ARGV: pending key prefix, mode. Returns the count left. */
const PENDING_ACCOUNT_CLEANUP_SCRIPT = `
local remaining = 0
for _,id in ipairs(redis.call('SMEMBERS', KEYS[1])) do
  local key = ARGV[1] .. id
  if ARGV[2] == 'purge' then
    redis.call('DEL', key, key .. ':attempts', key .. ':linkcode')
  elseif redis.call('EXISTS', key) == 1 then
    remaining = remaining + 1
  end
end
if ARGV[2] == 'purge' then redis.call('DEL', KEYS[1]) end
return remaining
`;

export class RedisOAuthStateStore implements OAuthStateStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisOAuthStateStore.name);
  private readonly client: RedisClientType;
  private connected = false;
  private readonly prefix = 'gateway:oauth-state:';
  private readonly callbackGrantPrefix = 'gateway:oauth-callback-grant:';
  private readonly pendingPrefix = 'gateway:oauth-pending:';
  /** Per-account set of pending intent ids, so deletion can find them. */
  private readonly pendingUserPrefix = 'gateway:oauth-pending-user:';
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

  private pendingKeys(code: string): [string, string, string] {
    const base = `${this.pendingPrefix}${code}`;
    return [base, `${base}:attempts`, `${base}:linkcode`];
  }

  async createPendingIntent(
    code: string,
    intent: StoredPendingOAuthIntent
  ): Promise<void> {
    if (!isPendingIntent(intent))
      throw new HttpException(
        'Invalid pending OAuth intent',
        HttpStatus.BAD_REQUEST
      );
    this.requireConnection();
    const ttl = Math.max(1, intent.expiresAt - Date.now());
    const [key] = this.pendingKeys(code);
    // The key expires on its own; NX keeps an id from ever being replaced.
    // Link intents (userId set) are also indexed in a per-account set with the
    // same TTL, created atomically with the deletion-fence check, so account
    // deletion can find and remove them and nothing is created after a purge.
    const account = intent.userId?.toLowerCase() ?? '';
    const result = await this.client.sendCommand([
      'EVAL',
      PENDING_CREATE_SCRIPT,
      '3',
      key,
      this.deletionFenceKey,
      account ? `${this.pendingUserPrefix}${account}` : key,
      JSON.stringify(intent),
      String(ttl),
      account ? accountFenceKey(account) : '',
      code,
    ]);
    if (Number(result) === -1) throw new Error('OAUTH_ACCOUNT_DELETION_FENCED');
    if (Number(result) !== 1)
      throw new HttpException(
        'OAuth is temporarily busy',
        HttpStatus.TOO_MANY_REQUESTS
      );
  }

  async getPendingIntent(
    code: string,
    binding: PendingOAuthBinding
  ): Promise<StoredPendingOAuthIntent | undefined> {
    this.requireConnection();
    const value = await this.client.sendCommand([
      'GET',
      this.pendingKeys(code)[0],
    ]);
    return this.parseBoundPending(value, binding);
  }

  async consumePendingIntent(
    code: string,
    binding: PendingOAuthBinding
  ): Promise<StoredPendingOAuthIntent | undefined> {
    this.requireConnection();
    const [key, attempts, linkCode] = this.pendingKeys(code);
    const value = await this.client.sendCommand([
      'EVAL',
      "local value=redis.call('GET', KEYS[1]); if not value then return nil end; local intent=cjson.decode(value); if intent.stateId ~= ARGV[1] or intent.nonceHash ~= ARGV[2] then return nil end; redis.call('DEL', KEYS[1], KEYS[2], KEYS[3]); return value",
      '3',
      key,
      attempts,
      linkCode,
      binding.stateId,
      binding.nonceHash,
    ]);
    return this.parseBoundPending(value, binding);
  }

  async recordPendingAttempt(
    code: string,
    binding: PendingOAuthBinding,
    max: number
  ): Promise<number | undefined> {
    this.requireConnection();
    const [key, attempts, linkCode] = this.pendingKeys(code);
    const result = await this.client.sendCommand([
      'EVAL',
      "local value=redis.call('GET', KEYS[1]); if not value then return -1 end; local intent=cjson.decode(value); if intent.stateId ~= ARGV[1] or intent.nonceHash ~= ARGV[2] then return -1 end; local n=redis.call('INCR', KEYS[2]); if n == 1 then redis.call('PEXPIRE', KEYS[2], redis.call('PTTL', KEYS[1])) end; if n >= tonumber(ARGV[3]) then redis.call('DEL', KEYS[1], KEYS[2], KEYS[3]) end; return n",
      '3',
      key,
      attempts,
      linkCode,
      binding.stateId,
      binding.nonceHash,
      String(max),
    ]);
    const n = Number(result);
    return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
  }

  async setPendingLinkCode(
    code: string,
    binding: PendingOAuthBinding,
    linkCodeValue: PendingOAuthLinkCode
  ): Promise<boolean> {
    this.requireConnection();
    const [key, , linkCode] = this.pendingKeys(code);
    const result = await this.client.sendCommand([
      'EVAL',
      "local value=redis.call('GET', KEYS[1]); if not value then return 0 end; local intent=cjson.decode(value); if intent.stateId ~= ARGV[1] or intent.nonceHash ~= ARGV[2] then return 0 end; redis.call('SET', KEYS[2], ARGV[3], 'PX', redis.call('PTTL', KEYS[1])); return 1",
      '2',
      key,
      linkCode,
      binding.stateId,
      binding.nonceHash,
      JSON.stringify(linkCodeValue),
    ]);
    return Number(result) === 1;
  }

  async getPendingLinkCode(
    code: string,
    binding: PendingOAuthBinding
  ): Promise<PendingOAuthLinkCode | undefined> {
    if (!(await this.getPendingIntent(code, binding))) return undefined;
    const value = await this.client.sendCommand([
      'GET',
      this.pendingKeys(code)[2],
    ]);
    if (typeof value !== 'string') return undefined;
    try {
      const parsed = JSON.parse(value) as PendingOAuthLinkCode;
      return typeof parsed.codeHash === 'string' &&
        typeof parsed.expiresAt === 'number'
        ? parsed
        : undefined;
    } catch {
      return undefined;
    }
  }

  private parseBoundPending(
    value: unknown,
    binding: PendingOAuthBinding
  ): StoredPendingOAuthIntent | undefined {
    if (typeof value !== 'string') return undefined;
    try {
      const intent = JSON.parse(value) as unknown;
      return isPendingIntent(intent) &&
        bindingMatches(intent, binding) &&
        intent.expiresAt > Date.now()
        ? intent
        : undefined;
    } catch {
      return undefined;
    }
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
    await this.client.sendCommand([
      'EVAL',
      PENDING_ACCOUNT_CLEANUP_SCRIPT,
      '1',
      `${this.pendingUserPrefix}${accountId}`,
      this.pendingPrefix,
      'purge',
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
    // The fence is set by now (a missing fence returned -2 above), so no new
    // pending intent can be indexed while these are removed or counted.
    const pending = await this.client.sendCommand([
      'EVAL',
      PENDING_ACCOUNT_CLEANUP_SCRIPT,
      '1',
      `${this.pendingUserPrefix}${accountId.toLowerCase()}`,
      this.pendingPrefix,
      mode,
    ]);
    if (
      typeof pending !== 'number' ||
      !Number.isSafeInteger(pending) ||
      pending < 0
    )
      throw new Error('OAUTH_DELETION_UNVERIFIED');
    return result + pending;
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
