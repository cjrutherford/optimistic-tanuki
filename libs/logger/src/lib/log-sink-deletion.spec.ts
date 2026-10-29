import {
  verifyLogSinkDeletion,
  LogSinkPurgeAdapter,
} from './log-sink-deletion';
const selection = {
  accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  profileIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
};
describe('Declared log-sink deletion contracts', () => {
  it('rejects invalid identity input before any purge', async () => {
    const purge = jest.fn();
    await expect(
      verifyLogSinkDeletion(
        { ...selection, accountId: 'SECRET/not-uuid' },
        [{ id: 'local.activity', deletionMode: 'account-keyed' }],
        new Map([['local.activity', { purge, readback: async () => 0 }]])
      )
    ).rejects.toThrow('INVALID_LOG_SUBJECT_SELECTION');
    expect(purge).not.toHaveBeenCalled();
  });
  it('never treats an empty or duplicate inventory as success', async () => {
    for (const sinks of [
      [],
      [
        { id: 'same', deletionMode: 'account-keyed' as const },
        { id: 'same', deletionMode: 'account-keyed' as const },
      ],
    ])
      expect(
        (await verifyLogSinkDeletion(selection, sinks, new Map()))
          .allDeclaredSinksVerified
      ).toBe(false);
  });
  it('blocks missing operator adapters and unreviewed shared audit ownership', async () => {
    const purge = jest.fn();
    const r = await verifyLogSinkDeletion(
      selection,
      [
        { id: 'docker.stdout', deletionMode: 'operator-managed' },
        { id: 'shared.audit', deletionMode: 'shared-unresolved' },
      ],
      new Map([['shared.audit', { purge, readback: async () => 0 }]])
    );
    expect(r.allDeclaredSinksVerified).toBe(false);
    expect(r.results.map((x) => x.code)).toEqual([
      'PURGE_UNSUPPORTED',
      'OWNERSHIP_UNVERIFIED',
    ]);
    expect(purge).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain(selection.accountId);
  });
  it('requires a zero readback and preserves a counterpart in a scoped adapter', async () => {
    let rows = [
      { accountId: selection.accountId },
      { accountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    ];
    const adapter: LogSinkPurgeAdapter = {
      purge: async (subject) => {
        rows = rows.filter((row) => row.accountId !== subject.accountId);
      },
      readback: async (subject) =>
        rows.filter((row) => row.accountId === subject.accountId).length,
    };
    const r = await verifyLogSinkDeletion(
      selection,
      [{ id: 'local.activity', deletionMode: 'account-keyed' }],
      new Map([['local.activity', adapter]])
    );
    expect(r.allDeclaredSinksVerified).toBe(true);
    expect(rows).toEqual([
      { accountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    ]);
  });
  it.each([1, NaN, -1])(
    'rejects an invalid or nonzero readback (%s)',
    async (count) => {
      const r = await verifyLogSinkDeletion(
        selection,
        [{ id: 'local.activity', deletionMode: 'account-keyed' }],
        new Map([
          [
            'local.activity',
            { purge: async () => undefined, readback: async () => count },
          ],
        ])
      );
      expect(r.allDeclaredSinksVerified).toBe(false);
    }
  );
  it('contains purge/read failures without serializing their private error text', async () => {
    const r = await verifyLogSinkDeletion(
      selection,
      [
        { id: 'one', deletionMode: 'account-keyed' },
        { id: 'two', deletionMode: 'account-keyed' },
      ],
      new Map([
        [
          'one',
          {
            purge: async () => {
              throw new Error('PRIVATE_ERROR');
            },
            readback: async () => 0,
          },
        ],
        [
          'two',
          {
            purge: async () => undefined,
            readback: async () => {
              throw new Error('PRIVATE_ERROR');
            },
          },
        ],
      ])
    );
    expect(r.results.map((x) => x.code)).toEqual([
      'PURGE_FAILED',
      'READBACK_FAILED',
    ]);
    expect(JSON.stringify(r)).not.toContain('PRIVATE_ERROR');
  });
  it('freezes the subject selection against adapter mutation', async () => {
    const observed: string[] = [];
    const r = await verifyLogSinkDeletion(
      selection,
      [
        { id: 'one', deletionMode: 'account-keyed' },
        { id: 'two', deletionMode: 'account-keyed' },
      ],
      new Map([
        [
          'one',
          {
            purge: async (subject) => {
              subject.accountId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
            },
            readback: async () => 0,
          },
        ],
        [
          'two',
          {
            purge: async (subject) => {
              observed.push(subject.accountId);
            },
            readback: async () => 0,
          },
        ],
      ])
    );
    expect(r.results[0].code).toBe('PURGE_FAILED');
    expect(observed).toEqual([selection.accountId]);
  });
});
