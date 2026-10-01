import {
  link,
  mkdir,
  rename,
  rm,
  stat,
  unlink,
  readFile,
  writeFile,
  utimes,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, relative, resolve, isAbsolute } from 'node:path';

export interface PreparedMarkdown {
  readonly path: string;
  commit(): Promise<void>;
  abort(): Promise<void>;
  rollback(): Promise<void>;
}

export interface PublicationLockOptions {
  waitMs?: number;
  staleMs?: number;
  pollMs?: number;
  heartbeatMs?: number;
}

export interface PublicationLock {
  readonly token: string;
  readonly path: string;
  renew(): Promise<boolean>;
  release(): Promise<void>;
}

export function defaultPublicationLockPath(): string {
  return join(process.cwd(), 'data', 'publication.lock');
}

/**
 * The lock guards story and Markdown writes, which only conflict between runs
 * that share a database. A run on a SQLite file locks beside that file, so a
 * replay and a live run on separate databases proceed in parallel while runs
 * on the same database still serialize. Other targets use the global lock.
 */
export function publicationLockPathFor(
  database: { type?: string; database?: unknown } | undefined
): string {
  const file =
    database?.type === 'better-sqlite3' && typeof database.database === 'string'
      ? database.database
      : '';
  if (!file || file === ':memory:' || file.startsWith('file:'))
    return defaultPublicationLockPath();
  return `${resolve(file)}.publication.lock`;
}

/**
 * Coarse cross-process serialization for canonical story and Markdown writes.
 * The lock directory is acquired with mkdir (an OS-level exclusive operation),
 * renamed atomically for stale recovery/release, and always released by the
 * caller's finally block.  This intentionally trades throughput for simple
 * POC-wide consistency across town editions.
 */
export async function acquirePublicationLock(
  lockPath = defaultPublicationLockPath(),
  options: PublicationLockOptions = {}
): Promise<PublicationLock> {
  if (!lockPath || lockPath.includes('\0'))
    throw new Error('unsafe publication lock path');
  const directory = `${resolve(lockPath)}.d`;
  await mkdir(resolve(directory, '..'), { recursive: true });
  const token = randomUUID();
  const waitMs = options.waitMs ?? 10_000;
  const staleMs = options.staleMs ?? 15 * 60_000;
  const pollMs = options.pollMs ?? 25;
  const deadline = Date.now() + waitMs;
  while (true) {
    try {
      await mkdir(directory);
      await writeFile(
        join(directory, 'owner.json'),
        JSON.stringify({
          token,
          pid: process.pid,
          createdAt: new Date().toISOString(),
        }),
        { flag: 'wx' }
      );
      let released = false;
      let ownershipLost = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
      const stopHeartbeat = () => {
        if (heartbeatTimer !== undefined) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = undefined;
        }
      };
      const renew = async (): Promise<boolean> => {
        if (released || ownershipLost) return false;
        try {
          const ownerPath = join(directory, 'owner.json');
          const owner = JSON.parse(await readFile(ownerPath, 'utf8')) as {
            token?: string;
          };
          if (owner.token !== token) {
            ownershipLost = true;
            stopHeartbeat();
            return false;
          }
          const now = new Date();
          await utimes(directory, now, now);
          const confirmedOwner = JSON.parse(
            await readFile(ownerPath, 'utf8')
          ) as { token?: string };
          if (confirmedOwner.token !== token) {
            ownershipLost = true;
            stopHeartbeat();
            return false;
          }
          return true;
        } catch {
          ownershipLost = true;
          stopHeartbeat();
          return false;
        }
      };
      const heartbeatMs =
        staleMs > 1
          ? Math.max(
              1,
              Math.min(
                Math.floor(staleMs / 3),
                options.heartbeatMs ?? Math.floor(staleMs / 3)
              )
            )
          : 0;
      if (heartbeatMs > 0) {
        heartbeatTimer = setInterval(() => {
          void renew().catch(() => {
            ownershipLost = true;
            stopHeartbeat();
          });
        }, heartbeatMs);
        heartbeatTimer.unref?.();
      }
      return {
        token,
        path: lockPath,
        async renew() {
          return renew();
        },
        async release() {
          if (released) return;
          released = true;
          stopHeartbeat();
          const releasedPath = `${directory}.released-${token}`;
          try {
            const owner = JSON.parse(
              await readFile(join(directory, 'owner.json'), 'utf8')
            ) as { token?: string };
            if (owner.token !== token) return;
            await rename(directory, releasedPath);
            await rm(releasedPath, { recursive: true, force: true });
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const details = await stat(directory);
        if (Date.now() - details.mtimeMs >= staleMs) {
          const stalePath = `${directory}.stale-${token}`;
          try {
            await rename(directory, stalePath);
            await rm(stalePath, { recursive: true, force: true });
            continue;
          } catch (staleError) {
            if ((staleError as NodeJS.ErrnoException).code !== 'ENOENT')
              throw staleError;
            continue;
          }
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== 'ENOENT')
          throw statError;
        continue;
      }
      if (Date.now() >= deadline)
        throw new Error(`publication lock busy: ${lockPath}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, pollMs));
    }
  }
}

export async function withPublicationLock<T>(
  lockPath: string | undefined,
  work: () => Promise<T>,
  options?: PublicationLockOptions
): Promise<T> {
  const lock = await acquirePublicationLock(
    lockPath ?? defaultPublicationLockPath(),
    options
  );
  try {
    return await work();
  } finally {
    await lock.release();
  }
}

function outputPath(
  rootDirectory: string,
  localitySlug: string,
  filename: string
): { directory: string; path: string } {
  if (
    !rootDirectory ||
    rootDirectory.includes('\0') ||
    !localitySlug ||
    localitySlug.includes('/') ||
    localitySlug.includes('\\') ||
    localitySlug.includes('..') ||
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..')
  ) {
    throw new Error('unsafe Markdown output path');
  }
  const root = resolve(rootDirectory);
  const directory = resolve(root, localitySlug);
  const path = resolve(directory, filename);
  const escaped = relative(root, path);
  if (
    escaped === '..' ||
    escaped.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(escaped)
  )
    throw new Error('Markdown output path escapes outputDirectory');
  return { directory, path };
}

/** Keep staging names below filesystem component limits even when the final
 * artifact name and receipt token are both content addressed and long. The
 * deterministic identity is hashed, then paired with a per-preparation
 * cryptographic nonce so concurrent identical preparations cannot share a
 * staging path or clean up one another's files. */
function temporaryPath(
  directory: string,
  purpose: string,
  filename: string,
  token: string,
  nonce: string,
  contents?: string | Buffer
): string {
  const digest = createHash('sha256')
    .update(purpose)
    .update('\0')
    .update(filename)
    .update('\0')
    .update(token)
    .update('\0')
    .update(contents ?? '')
    .digest('hex');
  return join(directory, `.${purpose}-${digest}-${nonce}.tmp`);
}

export async function prepareMarkdown(
  rootDirectory: string,
  localitySlug: string,
  filename: string,
  markdown: string,
  token: string
): Promise<PreparedMarkdown> {
  const { directory, path } = outputPath(rootDirectory, localitySlug, filename);
  if (
    !token ||
    token.includes('\0') ||
    token.includes('/') ||
    token.includes('\\') ||
    token.includes('..')
  )
    throw new Error('unsafe Markdown output token');
  await mkdir(directory, { recursive: true });
  const nonce = randomUUID();
  const temporary = temporaryPath(
    directory,
    'write',
    filename,
    token,
    nonce,
    markdown
  );
  let previous: Buffer | null | undefined;
  try {
    const existing = await stat(path);
    previous = existing.isFile() ? await readFile(path) : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    previous = undefined;
  }
  const rollbackTemporary = temporaryPath(
    directory,
    'rollback',
    filename,
    token,
    nonce,
    previous ?? ''
  );
  try {
    await writeFile(temporary, markdown, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    try {
      await unlink(temporary);
    } catch {
      /* absent */
    }
    throw error;
  }
  return {
    path,
    async commit() {
      try {
        await rename(temporary, path);
      } finally {
        try {
          await unlink(temporary);
        } catch {
          /* renamed or absent */
        }
      }
    },
    async abort() {
      try {
        await unlink(temporary);
      } catch {
        /* already absent */
      }
    },
    async rollback() {
      if (previous === undefined) {
        try {
          await unlink(path);
        } catch {
          /* already absent or non-file target */
        }
      } else if (previous !== null) {
        await writeFile(rollbackTemporary, previous, { flag: 'wx' });
        try {
          await rename(rollbackTemporary, path);
        } finally {
          try {
            await unlink(rollbackTemporary);
          } catch {
            /* renamed or absent */
          }
        }
      }
      try {
        await unlink(temporary);
      } catch {
        /* already absent */
      }
    },
  };
}

/**
 * Prepare a content-addressed/revision artifact without ever replacing a
 * file at the target path.  Replaying the same content is an idempotent
 * no-op; a different payload must use a new revision/input-derived filename.
 * The temporary file is linked into place (link is exclusive) so a concurrent
 * writer cannot win by silently overwriting an immutable artifact.
 */
export async function prepareImmutableMarkdown(
  rootDirectory: string,
  localitySlug: string,
  filename: string,
  markdown: string,
  token: string
): Promise<PreparedMarkdown> {
  const { directory, path } = outputPath(rootDirectory, localitySlug, filename);
  if (
    !token ||
    token.includes('\0') ||
    token.includes('/') ||
    token.includes('\\') ||
    token.includes('..')
  )
    throw new Error('unsafe Markdown output token');
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from(markdown, 'utf8');
  try {
    const existing = await readFile(path);
    if (existing.equals(bytes)) {
      return { path, async commit() {}, async abort() {}, async rollback() {} };
    }
    throw new Error(
      `immutable Markdown artifact already exists with different contents: ${path}`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = temporaryPath(
    directory,
    'immutable',
    filename,
    token,
    randomUUID(),
    bytes
  );
  let committed = false;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
  } catch (error) {
    try {
      await unlink(temporary);
    } catch {
      /* absent */
    }
    throw error;
  }
  return {
    path,
    async commit() {
      try {
        await link(temporary, path);
        committed = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const existing = await readFile(path);
        if (!existing.equals(bytes))
          throw new Error(
            `immutable Markdown artifact already exists with different contents: ${path}`
          );
      } finally {
        try {
          await unlink(temporary);
        } catch {
          /* linked or absent */
        }
      }
    },
    async abort() {
      try {
        await unlink(temporary);
      } catch {
        /* already absent */
      }
    },
    async rollback() {
      if (committed) {
        try {
          await unlink(path);
        } catch {
          /* already absent */
        }
      }
      try {
        await unlink(temporary);
      } catch {
        /* already absent */
      }
    },
  };
}

export async function publishMarkdown(
  rootDirectory: string,
  localitySlug: string,
  filename: string,
  markdown: string,
  token: string
): Promise<string> {
  const prepared = await prepareMarkdown(
    rootDirectory,
    localitySlug,
    filename,
    markdown,
    token
  );
  await prepared.commit();
  return prepared.path;
}
