import { createHash, randomUUID } from 'node:crypto';
import { createClient } from 'redis';

type Client = ReturnType<typeof createClient>;
export type Job = {
  id: string;
  type: string;
  data: unknown;
  attempt: number;
  maxAttempts: number;
  status: string;
  token?: string;
  error?: string;
  due?: number;
  finishedAt?: number;
};

// Each transition performs at most one mutation. Redis scripts serialize commands,
// but do not roll back writes after an error. A single record contains the lease
// and schedule so a failed write cannot leave two indexes inconsistent.
const CONFIG = `
local config=redis.call('HGET',KEYS[1],'!config')
if config and config ~= ARGV[1] then return redis.error_reply('Queue configuration mismatch') end
if redis.call('HLEN',KEYS[1]) > tonumber(ARGV[2])+2 then return redis.error_reply('Queue exceeds configured capacity') end`;
const ENQUEUE =
  CONFIG +
  `
if redis.call('HGET',KEYS[1],ARGV[3]) then return 0 end
local count=redis.call('HLEN',KEYS[1])
if redis.call('HEXISTS',KEYS[1],'!config') == 1 then count=count-1 end
if redis.call('HEXISTS',KEYS[1],'!readiness') == 1 then count=count-1 end
if count >= tonumber(ARGV[2]) then return redis.error_reply('Queue full') end
redis.call('HSET',KEYS[1],'!config',ARGV[1],ARGV[3],ARGV[4]); return 1`;
const CLAIM =
  CONFIG +
  `
local entries=redis.call('HGETALL',KEYS[1])
for i=1,#entries,2 do
 local id=entries[i]
 if id ~= '!readiness' and id ~= '!config' then
  local job=cjson.decode(entries[i+1])
  if (job.status == 'completed' or job.status == 'failed') and job.finishedAt and job.finishedAt + tonumber(ARGV[6]) <= tonumber(ARGV[3]) then
   redis.call('HDEL',KEYS[1],id); return false
  end
  if (job.status == 'waiting' or job.status == 'active') and job.due <= tonumber(ARGV[3]) then
   if job.attempt >= job.maxAttempts then
    job.status='failed'; job.error='lease expired'; job.token=nil; job.due=nil; job.finishedAt=tonumber(ARGV[3])
   else
    job.attempt=job.attempt+1; job.status='active'; job.token=ARGV[5]; job.due=tonumber(ARGV[4])
   end
   local encoded=cjson.encode(job)
   if #encoded > 16000 then return redis.error_reply('Job too large') end
   redis.call('HSET',KEYS[1],id,encoded)
   if job.status == 'active' then return encoded end
   return false
  end
 end
end
return false`;
const FINISH =
  CONFIG +
  `
local raw=redis.call('HGET',KEYS[1],ARGV[3]); if not raw then return 0 end
local job=cjson.decode(raw)
if job.status ~= 'active' or job.token ~= ARGV[4] then return 0 end
job.token=nil
if ARGV[5] == 'completed' then job.status='completed'; job.due=nil; job.finishedAt=tonumber(ARGV[7])
elseif job.attempt >= job.maxAttempts then job.status='failed'; job.error=ARGV[6]; job.due=nil; job.finishedAt=tonumber(ARGV[7])
else job.status='waiting'; job.error=ARGV[6]; job.due=tonumber(ARGV[7]) end
local encoded=cjson.encode(job)
if #encoded > 16000 then return redis.error_reply('Job too large') end
redis.call('HSET',KEYS[1],ARGV[3],encoded); return 1`;
// Match every hash command used by enqueue, claim, finish and get on the
// actual queue key. EVAL itself is checked by invoking this script.
const READY =
  `
if not redis.acl_check_cmd('HGET',KEYS[1],'!config')
 or not redis.acl_check_cmd('HLEN',KEYS[1])
 or not redis.acl_check_cmd('HEXISTS',KEYS[1],'!config')
 or not redis.acl_check_cmd('HGETALL',KEYS[1])
 or not redis.acl_check_cmd('HSET',KEYS[1],'!readiness','1')
 or not redis.acl_check_cmd('HDEL',KEYS[1],'!readiness') then return redis.error_reply('Queue ACL denied') end
` +
  CONFIG +
  `
redis.call('HGETALL',KEYS[1])
redis.call('HSET',KEYS[1],'!readiness','1')
return 1`;

export class DirectoryQueue {
  private constructor(
    private readonly client: Client,
    private readonly keys: string[],
    private readonly config: string[]
  ) {}
  static async connect(
    url: string,
    prefix: string,
    options: { maxJobs?: number; retentionMs?: number } = {}
  ): Promise<DirectoryQueue> {
    const maxJobs = options.maxJobs ?? 1000;
    const retentionMs = options.retentionMs ?? 86400000;
    if (
      !Number.isInteger(maxJobs) ||
      maxJobs < 1 ||
      maxJobs > 1000 ||
      !Number.isSafeInteger(retentionMs) ||
      retentionMs < 1 ||
      retentionMs > 2592000000
    )
      throw new Error('Invalid queue limits');
    if (!url || !/^[A-Za-z0-9_-]+$/.test(prefix))
      throw new Error(
        'Redis URL and explicit alphanumeric queue prefix are required'
      );
    let connected = false;
    const client = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) =>
          connected ? Math.min(100 * 2 ** Math.min(retries, 5), 2000) : false,
      },
    });
    client.on('error', () => undefined);
    await client.connect();
    connected = true;
    return new DirectoryQueue(
      client,
      [`${prefix}:jobs-v3`],
      [`${maxJobs}:${retentionMs}`, String(maxJobs), String(retentionMs)]
    );
  }
  private key(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }
  async ready(): Promise<boolean> {
    try {
      return (
        Number(
          await this.client.eval(READY, {
            keys: this.keys,
            arguments: this.config.slice(0, 2),
          })
        ) === 1
      );
    } catch {
      return false;
    }
  }
  async enqueue(
    id: string,
    type: string,
    data: unknown,
    maxAttempts = 3
  ): Promise<boolean> {
    if (
      !id ||
      !type ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 20
    )
      throw new Error('Invalid job');
    const job: Job = {
      id,
      type,
      data,
      maxAttempts,
      attempt: 0,
      status: 'waiting',
      due: Date.now(),
    };
    const encoded = JSON.stringify(job);
    if (Buffer.byteLength(encoded, 'utf8') > 5000)
      throw new Error('Job too large');
    return (
      Number(
        await this.client.eval(ENQUEUE, {
          keys: this.keys,
          arguments: [...this.config.slice(0, 2), this.key(id), encoded],
        })
      ) === 1
    );
  }
  async claim(leaseMs: number): Promise<Job | null> {
    if (!Number.isInteger(leaseMs) || leaseMs < 1)
      throw new Error('Invalid lease');
    const now = Date.now();
    const raw = await this.client.eval(CLAIM, {
      keys: this.keys,
      arguments: [
        ...this.config.slice(0, 2),
        String(now),
        String(now + leaseMs),
        randomUUID(),
        this.config[2],
      ],
    });
    return raw ? JSON.parse(String(raw)) : null;
  }
  private async finish(job: Job, result: string, error = ''): Promise<boolean> {
    if (!job.token) return false;
    return (
      Number(
        await this.client.eval(FINISH, {
          keys: this.keys,
          arguments: [
            ...this.config.slice(0, 2),
            this.key(job.id),
            job.token,
            result,
            error.slice(0, 500),
            String(Date.now()),
          ],
        })
      ) === 1
    );
  }
  complete(job: Job): Promise<boolean> {
    return this.finish(job, 'completed');
  }
  fail(job: Job, error: string): Promise<boolean> {
    return this.finish(job, 'failed', error);
  }
  async get(id: string): Promise<Job | null> {
    const value = await this.client.hGet(this.keys[0], this.key(id));
    return value ? JSON.parse(String(value)) : null;
  }
  async close(): Promise<void> {
    await this.client.close();
  }
}
