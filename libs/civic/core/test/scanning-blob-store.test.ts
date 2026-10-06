import {
  ContentScanError,
  createScanningBlobStore,
  type ContentScanner,
} from '../src/scanning-blob-store.js';
import type { BlobStore } from '../src/types.js';

function memoryStore(): BlobStore & { puts: number } {
  const blobs = new Map<string, Uint8Array>();
  const store = {
    puts: 0,
    async put(input: Uint8Array) {
      store.puts += 1;
      const ref = `sha256:${blobs.size}` as never;
      blobs.set(ref, input);
      return ref;
    },
    async get(ref: string) {
      return blobs.get(ref)!;
    },
    async has(ref: string) {
      return blobs.has(ref);
    },
  };
  return store as never;
}

const scanner = (
  verdict: () => Promise<{ clean: boolean; threats: string[] }>
): ContentScanner => ({
  scan: async () => ({ ...(await verdict()), scanner: 'test' }),
});

describe('scanning blob store (D22)', () => {
  it('stores a document the scanner passes', async () => {
    const inner = memoryStore();
    const store = createScanningBlobStore(
      inner,
      scanner(async () => ({ clean: true, threats: [] }))
    );
    const ref = await store.put(new Uint8Array([1, 2]), 'application/pdf');
    expect(await store.has(ref)).toBe(true);
    expect(inner.puts).toBe(1);
  });

  it('never stores an infected document, and the failure is not retried', async () => {
    const inner = memoryStore();
    const store = createScanningBlobStore(
      inner,
      scanner(async () => ({ clean: false, threats: ['Eicar-Test-Signature'] }))
    );
    const failure = await store
      .put(new Uint8Array([1]), 'application/pdf')
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ContentScanError);
    expect(failure).toMatchObject({
      code: 'infected',
      kind: 'policy',
      retryable: false,
      threats: ['Eicar-Test-Signature'],
    });
    expect(inner.puts).toBe(0);
  });

  it('fails closed, retryably, when the scanner cannot answer', async () => {
    const inner = memoryStore();
    const store = createScanningBlobStore(
      inner,
      scanner(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:3310');
      })
    );
    await expect(
      store.put(new Uint8Array([1]), 'application/pdf')
    ).rejects.toMatchObject({
      code: 'scanner-unavailable',
      kind: 'network',
      retryable: true,
    });
    expect(inner.puts).toBe(0);
  });
});
