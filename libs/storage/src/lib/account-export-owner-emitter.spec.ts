import { createHash } from 'node:crypto';
import {
  AccountExportOwnerCaptureVerifier,
  AccountExportOwnerRecord,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerEmitterError,
} from './account-export-owner-emitter';

type Source = 'identity' | 'profile';
const accountId = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const config = {
  participantId: 'profile',
  accountId,
  captureId: 'capture-1',
  snapshotAt: '2026-10-20T12:00:00.000Z',
  sources: ['identity', 'profile'] as const,
  maxPageRecords: 2,
  maxPageBytes: 4096,
};

async function* rows<TSource extends string>(
  source: TSource,
  ids: string[]
): AsyncGenerator<AccountExportOwnerRecord<TSource>> {
  for (const id of ids) yield { source, data: { id, userId: accountId } };
}

describe('AccountExportOwnerEmitter', () => {
  it('packs pages by serialized bytes before reaching the record limit', async () => {
    const chunks: any[] = [];
    const options = {
      ...config,
      sources: ['profile'] as const,
      maxPageRecords: 100,
    };
    const records = Array.from({ length: 12 }, (_, index) => ({
      source: 'profile' as const,
      data: {
        id: index.toString().padStart(2, '0'),
        value: '\u0001'.repeat(400),
      },
    }));
    const emitter = new AccountExportOwnerEmitter(options, async (chunk) => {
      chunks.push(chunk);
    });
    await emitter.emitSources({
      profile: async function* () {
        yield* records;
      },
    });
    await emitter.complete();
    const verifier = new AccountExportOwnerCaptureVerifier(
      'profile',
      accountId,
      options.sources,
      createHash('sha256'),
      100,
      options.maxPageBytes
    );
    for (const chunk of chunks) {
      expect(Buffer.byteLength(JSON.stringify(chunk))).toBeLessThanOrEqual(
        options.maxPageBytes
      );
      verifier.accept(chunk);
    }
    expect(
      chunks.filter((chunk) => chunk.source === 'profile').length
    ).toBeGreaterThan(1);
    expect(chunks.flatMap((chunk) => chunk.records)).toEqual(records);
    expect(chunks.at(-1).sourceRowCounts.profile).toBe(records.length);
  });

  it('emits ordered bounded pages, explicit empty sources, counts and one verified end', async () => {
    const chunks: any[] = [];
    const emitter = new AccountExportOwnerEmitter(config, async (chunk) => {
      chunks.push(chunk);
    });
    await emitter.emitSources({
      identity: () => rows('identity', ['1', '2', '3']),
      profile: () => rows('profile', []),
    });
    expect(
      chunks.map((chunk) => [
        chunk.source,
        chunk.records.length,
        chunk.sourceComplete,
      ])
    ).toEqual([
      ['identity', 2, false],
      ['identity', 1, true],
      ['profile', 0, true],
    ]);
    const end = await emitter.complete();
    expect(end).toBe(chunks[chunks.length - 1]);
    const verifier = new AccountExportOwnerCaptureVerifier(
      'profile',
      accountId,
      config.sources,
      createHash('sha256'),
      2,
      4096
    );
    expect(chunks.map((chunk) => verifier.accept(chunk))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(end.sourceRowCounts).toEqual({ identity: 3, profile: 0 });
    expect(end.rowCount).toBe(3);
  });

  it('buffers a full page until exhaustion is known and never emits a trailing empty page', async () => {
    const chunks: any[] = [];
    const emitter = new AccountExportOwnerEmitter(
      { ...config, sources: ['profile'] as const, maxPageRecords: 1 },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    await emitter.emitSources({ profile: () => rows('profile', ['1']) });
    const end = await emitter.complete();
    expect(end).toBe(chunks[chunks.length - 1]);
    expect(
      chunks.map((chunk) => [
        chunk.source,
        chunk.records.length,
        chunk.sourceComplete,
      ])
    ).toEqual([
      ['profile', 1, true],
      ['end', 0, true],
    ]);
  });

  it('rejects oversized records and fails closed when the sink rejects a page', async () => {
    const emitter = new AccountExportOwnerEmitter(
      { ...config, sources: ['profile'] as const, maxPageBytes: 128 },
      async () => undefined
    );
    await expect(
      emitter.emitSources({
        profile: async function* () {
          yield {
            source: 'profile',
            data: { id: '1', userId: accountId, text: 'x'.repeat(512) },
          };
        },
      })
    ).rejects.toBeInstanceOf(AccountExportOwnerEmitterError);

    const sinkEmitter = new AccountExportOwnerEmitter(
      { ...config, sources: ['profile'] as const },
      async () => {
        throw new Error('sink failed');
      }
    );
    await expect(
      sinkEmitter.emitSources({ profile: () => rows('profile', ['1']) })
    ).rejects.toMatchObject({ code: 'OWNER_STREAM_CONSUMER_FAILED' });
  });

  it('snapshots source configuration and closes a producer iterator after sink failure', async () => {
    const mutableSources: Source[] = ['identity', 'profile'];
    const options = { ...config, sources: mutableSources, maxPageRecords: 1 };
    let finalized = false;
    const emitter = new AccountExportOwnerEmitter(options, async (chunk) => {
      mutableSources.splice(0, 2, 'profile');
      if (chunk.source === 'profile') throw new Error('sink failure');
    });
    await expect(
      emitter.emitSources({
        identity: () => rows('identity', []),
        profile: async function* () {
          try {
            yield { source: 'profile', data: { id: '1', userId: accountId } };
            yield { source: 'profile', data: { id: '2', userId: accountId } };
          } finally {
            finalized = true;
          }
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_STREAM_CONSUMER_FAILED' });
    expect(finalized).toBe(true);
  });
});
