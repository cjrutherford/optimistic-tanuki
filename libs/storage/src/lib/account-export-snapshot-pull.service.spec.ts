import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir, readlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
  ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
  AccountExportOwnerChunk,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import { AccountExportOwnerSpoolService } from './account-export-owner-spool.service';
import { AccountExportSnapshotPullService } from './account-export-snapshot-pull.service';

describe('AccountExportSnapshotPullService', () => {
  let root: string;
  let spool: AccountExportOwnerSpoolService;
  let pull: AccountExportSnapshotPullService;
  const activeDescriptors = async () => {
    const links = await Promise.all(
      (
        await readdir('/proc/self/fd')
      ).map(async (fd) => {
        try {
          return await readlink('/proc/self/fd/' + fd);
        } catch {
          return '';
        }
      })
    );
    return links.filter((link) =>
      link.startsWith(join(root, 'ot-owner-spool-'))
    ).length;
  };
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'snapshot-pull-'));
    spool = new AccountExportOwnerSpoolService();
    const actualCapture = spool.capture.bind(spool);
    jest
      .spyOn(spool, 'capture')
      .mockImplementation(((options: any, producer: any) =>
        actualCapture({ ...options, spoolRoot: root }, producer)) as any);
    pull = new AccountExportSnapshotPullService(spool);
  });
  afterEach(async () => {
    try {
      expect(await activeDescriptors()).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('pulls bounded JSONL pages, stages verified chunks, and cleans up on bad file hash', async () => {
    const participantId = 'fixture-participant',
      accountId = randomUUID(),
      captureId = randomUUID();
    const record = {
      source: 'alpha',
      data: { id: 'a1', accountId, value: '☃'.repeat(30000) },
    };
    const contentHash = createHash('sha256')
      .update(`${JSON.stringify(record)}\n`)
      .digest('hex');
    const common = {
      contractVersion: ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
      schemaVersion: ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
      participantId,
      accountId,
      captureId,
      snapshotAt: '2026-10-20 09:00:00.123456+00',
      endOfStream: false,
      complete: false,
      uncovered: [] as string[],
    };
    const terminal: AccountExportOwnerChunk<'alpha'> = {
      ...common,
      pageOrdinal: 2,
      source: 'end',
      cursor: null,
      records: [],
      sourceComplete: true,
      endOfStream: true,
      complete: true,
      rowCount: 1,
      checksum: contentHash,
      sourceRowCounts: { alpha: 1 },
      sourceDispositions: { alpha: 'retained' },
    };
    const chunks = [
      {
        ...common,
        pageOrdinal: 1,
        source: 'alpha',
        cursor: 'a1',
        records: [record],
        sourceComplete: true,
      },
      terminal,
    ];
    const bytes = Buffer.from(
      chunks.map((c) => JSON.stringify(c)).join('\n') + '\n'
    );
    const descriptor: AccountExportSnapshotDescriptor = {
      handleId: randomUUID(),
      participantId,
      accountId,
      captureId,
      snapshotAt: common.snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 1,
      sources: ['alpha'],
      sourceRowCounts: { alpha: 1 },
      sourceDispositions: { alpha: 'retained' },
      identityCount: 0,
      expiresAt: '2026-10-20T09:02:00.000Z',
    };
    const result = await pull.capture({
      participantId,
      accountId,
      sources: ['alpha'],
      snapshot: descriptor,
      read: async (offset, length) => ({
        handleId: descriptor.handleId,
        captureId,
        offset,
        bytesBase64: bytes.subarray(offset, offset + length).toString('base64'),
        eof: offset + length === bytes.length,
      }),
    });
    expect(result.metadata).toMatchObject({
      captureId,
      rowCount: 1,
      snapshotAt: '2026-10-20 09:00:00.123456+00',
    });
    expect(await activeDescriptors()).toBe(1);
    await result.cleanup();

    const wideRecord = {
      source: 'alpha',
      data: { id: 'a2', accountId, value: '' },
    };
    const widePage = {
      ...chunks[0],
      pageOrdinal: 2,
      cursor: 'a2',
      records: [wideRecord],
    };
    wideRecord.data.value = 'x'.repeat(
      ACCOUNT_EXPORT_SNAPSHOT_LIMITS.lineBytes -
        Buffer.byteLength(JSON.stringify(widePage))
    );
    expect(Buffer.byteLength(JSON.stringify(widePage))).toBe(
      ACCOUNT_EXPORT_SNAPSHOT_LIMITS.lineBytes
    );
    const wideTerminal = {
      ...terminal,
      pageOrdinal: 3,
      rowCount: 2,
      sourceRowCounts: { alpha: 2 },
      checksum: createHash('sha256')
        .update(`${JSON.stringify(record)}\n${JSON.stringify(wideRecord)}\n`)
        .digest('hex'),
    };
    const wideBytes = Buffer.from(
      [{ ...chunks[0], sourceComplete: false }, widePage, wideTerminal]
        .map((chunk) => JSON.stringify(chunk))
        .join('\n') + '\n'
    );
    const wideResult = await pull.capture({
      participantId,
      accountId,
      sources: ['alpha'],
      snapshot: {
        ...descriptor,
        sizeBytes: wideBytes.length,
        sha256: createHash('sha256').update(wideBytes).digest('hex'),
        rowCount: 2,
        sourceRowCounts: { alpha: 2 },
      },
      read: async (offset, length) => ({
        handleId: descriptor.handleId,
        captureId,
        offset,
        bytesBase64: wideBytes
          .subarray(offset, offset + length)
          .toString('base64'),
        eof: offset + length === wideBytes.length,
      }),
    });
    expect(wideResult.metadata.rowCount).toBe(2);
    await wideResult.cleanup();
    await expect(
      pull.capture({
        participantId,
        accountId,
        sources: ['alpha'],
        snapshot: { ...descriptor, sha256: '0'.repeat(64) },
        read: async (offset, length) => ({
          handleId: descriptor.handleId,
          captureId,
          offset,
          bytesBase64: bytes
            .subarray(offset, offset + length)
            .toString('base64'),
          eof: offset + length === bytes.length,
        }),
      })
    ).rejects.toBeDefined();
    expect(await readdir(root)).toEqual([]);

    const runBad = (mutate: (r: any) => any, body = bytes) =>
      pull.capture({
        participantId,
        accountId,
        sources: ['alpha'],
        snapshot: {
          ...descriptor,
          sizeBytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex'),
        },
        read: async (offset, length) =>
          mutate({
            handleId: descriptor.handleId,
            captureId,
            offset,
            bytesBase64: body
              .subarray(offset, offset + length)
              .toString('base64'),
            eof: offset + length === body.length,
          }),
      });
    const runDescriptor = (
      snapshot: AccountExportSnapshotDescriptor,
      sources: readonly string[] = ['alpha']
    ) =>
      pull.capture({
        participantId,
        accountId,
        sources,
        snapshot,
        read: async (offset, length) => ({
          handleId: snapshot.handleId,
          captureId: snapshot.captureId,
          offset,
          bytesBase64: bytes
            .subarray(offset, offset + length)
            .toString('base64'),
          eof: offset + length === bytes.length,
        }),
      });
    const invalidDescriptors: AccountExportSnapshotDescriptor[] = [
      { ...descriptor, accountId: randomUUID() },
      { ...descriptor, participantId: 'wrong' },
      { ...descriptor, sources: ['beta'] },
      { ...descriptor, captureId: 'bad-uuid' },
      { ...descriptor, sourceRowCounts: { alpha: 0 } },
      { ...descriptor, rowCount: 2 },
      { ...descriptor, sizeBytes: 256 * 1024 * 1024 + 1 },
    ];
    for (const invalid of invalidDescriptors)
      await expect(runDescriptor(invalid)).rejects.toBeDefined();
    await expect(runDescriptor(descriptor, ['beta'])).rejects.toBeDefined();
    await expect(
      runDescriptor(
        {
          ...descriptor,
          sources: ['alpha', 'profileIdentity'],
          sourceRowCounts: { alpha: 1, profileIdentity: 0 },
          sourceDispositions: { alpha: 'retained', profileIdentity: 'none' },
          identityCount: 1,
        },
        ['alpha', 'profileIdentity']
      )
    ).rejects.toBeDefined();
    for (const bad of [
      (r: any) => ({ ...r, offset: r.offset + 1 }),
      (r: any) => ({ ...r, handleId: randomUUID() }),
      (r: any) => ({ ...r, captureId: randomUUID() }),
      (r: any) => ({ ...r, eof: !r.eof }),
      (r: any) => ({ ...r, bytesBase64: r.bytesBase64.slice(0, -4) }),
      (r: any) => ({ ...r, bytesBase64: r.bytesBase64.slice(0, -4) + 'AB==' }),
    ])
      await expect(runBad(bad)).rejects.toBeDefined();

    const alterLines = (alter: (chunks: any[]) => any[]) =>
      Buffer.from(
        alter(chunks as any[])
          .map((c) => JSON.stringify(c))
          .join('\n') + '\n'
      );
    const changedCaptures = [
      alterLines((c) =>
        c.map((v, i) => (i === 0 ? { ...v, accountId: randomUUID() } : v))
      ),
      alterLines((c) =>
        c.map((v, i) => (i === 0 ? { ...v, participantId: 'wrong' } : v))
      ),
      alterLines((c) =>
        c.map((v, i) => (i === 0 ? { ...v, captureId: randomUUID() } : v))
      ),
      alterLines((c) =>
        c.map((v, i) =>
          i === 0
            ? { ...v, source: 'beta', records: [{ ...record, source: 'beta' }] }
            : v
        )
      ),
      alterLines((c) => c.map((v, i) => (i === 1 ? { ...v, rowCount: 2 } : v))),
      Buffer.from(JSON.stringify(chunks[0]) + '\n'),
      Buffer.concat([bytes, Buffer.from(JSON.stringify(terminal) + '\n')]),
    ];
    for (const changed of changedCaptures)
      await expect(runBad((r) => r, changed)).rejects.toBeDefined();
    for (const malformed of [
      Buffer.from('\n' + bytes.toString()),
      Buffer.from(bytes.toString().replace(/\n$/, '')),
      Buffer.concat([bytes, Buffer.from('{}\n')]),
      Buffer.from([0xff, ...bytes.subarray(1)]),
    ]) {
      await expect(
        runBad(
          (r) => ({
            ...r,
            bytesBase64: malformed
              .subarray(r.offset, r.offset + malformed.length)
              .toString('base64'),
          }),
          malformed
        )
      ).rejects.toBeDefined();
    }
    await expect(
      pull.capture({
        participantId,
        accountId,
        sources: ['alpha'],
        snapshot: descriptor,
        read: async () => {
          throw new Error('private transport detail');
        },
      })
    ).rejects.toBeDefined();
    const abort = new AbortController();
    abort.abort();
    await expect(
      pull.capture({
        participantId,
        accountId,
        sources: ['alpha'],
        snapshot: descriptor,
        signal: abort.signal,
        read: async () => {
          throw Error();
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_SPOOL_ABORTED' });
    const mutable = { ...descriptor };
    const mutationRun = pull.capture({
      participantId,
      accountId,
      sources: ['alpha'],
      snapshot: mutable,
      read: async (offset, length) => {
        mutable.captureId = randomUUID();
        return {
          handleId: descriptor.handleId,
          captureId,
          offset,
          bytesBase64: bytes
            .subarray(offset, offset + length)
            .toString('base64'),
          eof: offset + length === bytes.length,
        };
      },
    });
    const stable = await mutationRun;
    await stable.cleanup();
  });
});
