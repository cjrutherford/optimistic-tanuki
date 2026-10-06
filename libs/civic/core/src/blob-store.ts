import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { BlobRef, BlobStore } from './types.js';

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateBlobRef(ref: BlobRef, rootDir?: string): void {
  if (!ref || typeof ref !== 'object')
    throw new Error('invalid blob reference');
  if (typeof ref.store !== 'string' || !ref.store.trim())
    throw new Error('invalid blob store');
  if (!/^sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(ref.key))
    throw new Error('invalid blob key layout');
  const keyDigest = ref.key.slice(-64);
  if (ref.sha256 !== keyDigest || !/^[a-f0-9]{64}$/.test(ref.sha256))
    throw new Error('blob key and checksum disagree');
  if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 0)
    throw new Error('invalid blob byte count');
  if (typeof ref.contentType !== 'string' || !ref.contentType.trim())
    throw new Error('invalid blob content type');
  if (rootDir) {
    const root = resolve(rootDir);
    if (resolve(ref.store) !== root)
      throw new Error('blob reference belongs to a different store');
    const target = resolve(rootDir, ref.key);
    if (target !== root && !target.startsWith(`${root}${sep}`))
      throw new Error('blob path escapes store root');
  }
}

export function createLocalBlobStore(rootDir: string): BlobStore {
  const pathFor = (ref: BlobRef) => join(rootDir, ref.key);
  return {
    async put(input, contentType) {
      const bytes = Buffer.from(input);
      const sha256 = digest(bytes);
      const key = `sha256/${sha256.slice(0, 2)}/${sha256}`;
      const path = join(rootDir, key);
      mkdirSync(dirname(path), { recursive: true });
      if (!existsSync(path)) {
        const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
        writeFileSync(temporary, bytes, { flag: 'wx' });
        const fd = openSync(temporary, 'r');
        try {
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        try {
          renameSync(temporary, path);
        } catch {
          /* concurrent writer won */
        }
      }
      return { store: rootDir, key, sha256, bytes: bytes.length, contentType };
    },
    async get(ref) {
      validateBlobRef(ref, rootDir);
      const bytes = readFileSync(pathFor(ref));
      if (digest(bytes) !== ref.sha256 || bytes.length !== ref.bytes)
        throw new Error('blob checksum or byte count mismatch');
      return new Uint8Array(bytes);
    },
    async has(ref) {
      try {
        validateBlobRef(ref, rootDir);
        const stat = statSync(pathFor(ref));
        if (stat.size !== ref.bytes) return false;
        return digest(readFileSync(pathFor(ref))) === ref.sha256;
      } catch {
        return false;
      }
    },
  };
}
