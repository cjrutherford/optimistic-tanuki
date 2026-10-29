import { createHash } from 'node:crypto';
import {
  AccountExportOwnerCaptureVerifier,
  AccountExportOwnerChunk,
  isCompleteAccountExportOwnerEndEnvelope,
} from './account-export-owner.contract';

type Source = 'identity' | 'sessions';
const sources = ['identity', 'sessions'] as const;
const accountId = '10000000-0000-4000-8000-000000000001';
const captureId = '20000000-0000-4000-8000-000000000001';
const base = {
  contractVersion: 1 as const,
  schemaVersion: '2026-10-19.v1' as const,
  participantId: 'authentication',
  accountId,
  captureId,
  snapshotAt: '2026-10-19T00:00:00.000Z',
  endOfStream: false,
  complete: false,
};
function capture(): AccountExportOwnerChunk<Source>[] {
  const records = [
    { source: 'identity' as const, data: { id: accountId, accountId } },
  ];
  return [
    {
      ...base,
      source: 'identity',
      cursor: accountId,
      pageOrdinal: 1,
      records,
      sourceComplete: true,
    },
    {
      ...base,
      source: 'sessions',
      cursor: null,
      pageOrdinal: 2,
      records: [],
      sourceComplete: true,
    },
    {
      ...base,
      source: 'end',
      cursor: null,
      pageOrdinal: 3,
      records: [],
      sourceComplete: true,
      endOfStream: true,
      complete: true,
      rowCount: 1,
      checksum: createHash('sha256')
        .update(JSON.stringify(records[0]) + '\n')
        .digest('hex'),
      sourceRowCounts: { identity: 1, sessions: 0 },
      sourceDispositions: {
        identity: 'Own safe identity',
        sessions: 'Credentials excluded',
      },
      uncovered: [],
    },
  ];
}
const verifier = () =>
  new AccountExportOwnerCaptureVerifier(
    'authentication',
    accountId,
    sources,
    createHash('sha256')
  );

describe('AccountExportOwnerCaptureVerifier', () => {
  it('requires the ordered source stream, digest, exact counts and empty-source evidence', () => {
    const v = verifier();
    const chunks = capture();
    expect(v.accept(chunks[0])).toBe(false);
    expect(v.accept(chunks[1])).toBe(false);
    expect(v.accept(chunks[2])).toBe(true);
    expect(isCompleteAccountExportOwnerEndEnvelope(chunks[2])).toBe(true);
    expect(() => v.accept(chunks[2])).toThrow('OWNER_CAPTURE_CLOSED');
  });
  it('does not accept an end-envelope shape as proof of missing sources', () => {
    const end = capture()[2];
    end.pageOrdinal = 1;
    expect(isCompleteAccountExportOwnerEndEnvelope(end)).toBe(true);
    expect(() => verifier().accept(end)).toThrow(
      'OWNER_CAPTURE_END_UNVERIFIED'
    );
  });
  it.each([
    'accountId',
    'participantId',
    'captureId',
    'snapshotAt',
    'pageOrdinal',
  ] as const)(
    'rejects changed %s and permanently closes failed capture',
    (field) => {
      const v = verifier();
      const chunks = capture();
      v.accept(chunks[0]);
      const bad = {
        ...chunks[1],
        [field]: field === 'pageOrdinal' ? 9 : 'different',
      };
      expect(() => v.accept(bad)).toThrow();
      expect(() => v.accept(chunks[1])).toThrow('OWNER_CAPTURE_CLOSED');
    }
  );
  it.each([
    'checksum',
    'rowCount',
    'sourceRowCounts',
    'sourceDispositions',
  ] as const)('rejects incorrect terminal %s', (field) => {
    const v = verifier();
    const chunks = capture();
    v.accept(chunks[0]);
    v.accept(chunks[1]);
    const value =
      field === 'checksum'
        ? '0'.repeat(64)
        : field === 'rowCount'
        ? 2
        : { identity: 1 };
    expect(() =>
      v.accept({
        ...chunks[2],
        [field]: value,
      } as AccountExportOwnerChunk<Source>)
    ).toThrow();
  });
  it('rejects foreign account data and unexpected source order', () => {
    const foreign = capture()[0];
    foreign.records[0].data['userId'] = 'foreign-account';
    expect(() => verifier().accept(foreign)).toThrow(
      'OWNER_CAPTURE_FOREIGN_ACCOUNT'
    );
    expect(() =>
      verifier().accept({ ...capture()[0], source: 'sessions' })
    ).toThrow('OWNER_CAPTURE_SOURCE_ORDER_INVALID');
  });
  it('rejects repeated keys and cursor mismatches without keeping all prior records', () => {
    const v = verifier();
    const first = capture()[0];
    first.sourceComplete = false;
    v.accept(first);
    expect(() => v.accept({ ...first, pageOrdinal: 2 })).toThrow(
      'OWNER_CAPTURE_CURSOR_INVALID'
    );
    expect(() =>
      verifier().accept({ ...capture()[0], cursor: 'wrong' })
    ).toThrow('OWNER_CAPTURE_CURSOR_INVALID');
  });
  it('enforces complete-envelope byte limits including metadata', () => {
    const v = new AccountExportOwnerCaptureVerifier(
      'authentication',
      accountId,
      sources,
      createHash('sha256'),
      250,
      600
    );
    const chunk = { ...capture()[0], uncovered: ['x'.repeat(1000)] };
    expect(() => v.accept(chunk)).toThrow('OWNER_CAPTURE_INVALID_PAGE');
  });
  it('rejects a zero-row nonterminal page and extra counts', () => {
    expect(() =>
      verifier().accept({
        ...capture()[0],
        records: [],
        cursor: null,
        sourceComplete: false,
      })
    ).toThrow('OWNER_CAPTURE_CURSOR_INVALID');
    const v = verifier();
    const chunks = capture();
    v.accept(chunks[0]);
    v.accept(chunks[1]);
    expect(() =>
      v.accept({
        ...chunks[2],
        sourceRowCounts: { identity: 1, sessions: 0, unexpected: 0 },
      } as AccountExportOwnerChunk<Source>)
    ).toThrow('OWNER_CAPTURE_END_UNVERIFIED');
  });
});
