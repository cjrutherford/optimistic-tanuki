import type { BlobRef, BlobStore, FetchErrorKind } from './types.js';

/**
 * Every document fetched from outside is virus-scanned before it is stored
 * or parsed (owner rule D22). The blob store is where every downloaded
 * document passes, so scanning happens there: an infected file is never
 * stored, and a scanner that cannot answer stops the download rather than
 * letting it through unscanned.
 */
export interface ContentScanner {
  scan(
    content: Uint8Array,
    name: string
  ): Promise<{ clean: boolean; threats: string[]; scanner: string }>;
}

export class ContentScanError extends Error {
  constructor(
    message: string,
    readonly code: 'infected' | 'scanner-unavailable',
    readonly kind: FetchErrorKind,
    readonly retryable: boolean,
    readonly threats: readonly string[] = []
  ) {
    super(message);
    this.name = 'ContentScanError';
  }
}

export function createScanningBlobStore(
  inner: BlobStore,
  scanner: ContentScanner
): BlobStore {
  return {
    async put(input: Uint8Array, contentType: string): Promise<BlobRef> {
      let verdict: Awaited<ReturnType<ContentScanner['scan']>>;
      try {
        verdict = await scanner.scan(input, contentType);
      } catch (error) {
        throw new ContentScanError(
          `virus scan unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`,
          'scanner-unavailable',
          'network',
          true
        );
      }
      if (!verdict.clean) {
        throw new ContentScanError(
          `virus scan (${verdict.scanner}) found ${
            verdict.threats.join(', ') || 'a threat'
          }; the document was not stored`,
          'infected',
          'policy',
          false,
          verdict.threats
        );
      }
      return inner.put(input, contentType);
    },
    get: (ref) => inner.get(ref),
    has: (ref) => inner.has(ref),
  };
}
