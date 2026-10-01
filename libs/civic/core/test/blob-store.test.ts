import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalBlobStore } from '../src/blob-store.js';

describe('content-addressed blob store', () => {
  it('deduplicates bytes, uses the sha256 layout, and verifies reads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'civic-blobs-'));
    try {
      const store = createLocalBlobStore(root);
      const ref = await store.put(
        new TextEncoder().encode('hello'),
        'text/plain'
      );
      expect(ref.key).toMatch(/^sha256\/..\/[a-f0-9]{64}$/);
      expect(await store.has(ref)).toBe(true);
      expect(await store.get(ref)).toStrictEqual(
        new TextEncoder().encode('hello')
      );
      const second = await store.put(
        new TextEncoder().encode('hello'),
        'text/plain'
      );
      expect(second).toStrictEqual(ref);
      expect(statSync(join(root, ref.key)).size).toBe(5);
      expect(readFileSync(join(root, ref.key), 'utf8')).toBe('hello');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects traversal, malformed layout, mismatched digest, byte count, and content type refs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'civic-blobs-invalid-'));
    try {
      const store = createLocalBlobStore(root);
      const valid = await store.put(
        new TextEncoder().encode('hello'),
        'text/plain'
      );
      await expect(
        (() =>
          store.get({ ...valid, key: '../outside', sha256: valid.sha256 }))()
      ).rejects.toThrow(/blob|key|layout|digest/i);
      await expect(
        (() =>
          store.get({
            ...valid,
            key: 'sha256/aa/not-a-digest',
            sha256: valid.sha256,
          }))()
      ).rejects.toThrow(/blob|key|layout|digest/i);
      await expect(
        (() => store.get({ ...valid, sha256: '0'.repeat(64) }))()
      ).rejects.toThrow(/blob|checksum|digest/i);
      await expect(
        (() => store.get({ ...valid, bytes: 99 }))()
      ).rejects.toThrow(/blob|byte|checksum/i);
      await expect(
        (() => store.get({ ...valid, contentType: '' }))()
      ).rejects.toThrow(/blob|content/i);
      expect(
        await store.has({ ...valid, key: '../outside', sha256: valid.sha256 })
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports concurrent puts without exposing partial blobs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'civic-blobs-concurrent-'));
    try {
      const store = createLocalBlobStore(root);
      const refs = await Promise.all(
        Array.from({ length: 8 }, () =>
          store.put(new TextEncoder().encode('same bytes'), 'text/plain')
        )
      );
      expect(new Set(refs.map((ref) => ref.key)).size).toBe(1);
      expect(await store.has(refs[0])).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
