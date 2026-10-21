import {
  ProfileAccountExportLegacyReader,
  ProfileAccountExportLegacyReadError,
} from './account-export-legacy-reader';

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const MIN_ID = '00000000-0000-0000-0000-000000000000';
const OWNED_ID = '00000000-0000-0000-0000-000000000001';
const FOREIGN_ID = '00000000-0000-0000-0000-000000000002';

const collect = async <T>(source: AsyncIterable<T>): Promise<T[]> => {
  const values: T[] = [];
  for await (const value of source) values.push(value);
  return values;
};

const goalRow = (overrides: Record<string, unknown> = {}) => ({
  id: MIN_ID,
  userId: ACCOUNT_ID,
  namePrefix: 'goal',
  nameChars: 4,
  nameBytes: 4,
  descriptionPrefix: 'description',
  descriptionChars: 11,
  descriptionBytes: 11,
  target: -7,
  progress: -12,
  startDate: '2024-03-04 05:06:07.123456',
  endDate: null,
  completed: false,
  created_at: '2024-03-05 06:07:08.654321',
  hasRelatedProfileId: true,
  ownedRelatedProfileId: null,
  hasRelatedProjectId: true,
  ownedRelatedProjectId: OWNED_ID,
  ...overrides,
});

const projectRow = (overrides: Record<string, unknown> = {}) => ({
  id: MIN_ID,
  userId: ACCOUNT_ID,
  namePrefix: 'project',
  nameChars: 7,
  nameBytes: 7,
  descriptionPrefix: 'description',
  descriptionChars: 11,
  descriptionBytes: 11,
  created_at: '2024-03-05 06:07:08.654321',
  hasRelatedProfileId: false,
  ownedRelatedProfileId: null,
  hasTimeLineEventsId: true,
  ownedTimeLineEventsId: OWNED_ID,
  hasGoalsId: true,
  ownedGoalsId: null,
  ...overrides,
});

describe('ProfileAccountExportLegacyReader', () => {
  it('preserves goal scalars, nulls and SQL timestamps while redacting foreign references', async () => {
    const query = jest.fn().mockResolvedValue([goalRow()]);
    const reader = new ProfileAccountExportLegacyReader(ACCOUNT_ID, query);
    const [record] = await collect(reader.legacyGoalRows());
    expect(record).toEqual({
      source: 'legacyGoal',
      data: {
        id: MIN_ID,
        userId: ACCOUNT_ID,
        name: 'goal',
        description: 'description',
        target: -7,
        progress: -12,
        startDate: '2024-03-04 05:06:07.123456',
        endDate: null,
        completed: false,
        created_at: '2024-03-05 06:07:08.654321',
        relatedProfileId: { disposition: 'redacted-unowned-reference' },
        relatedProjectId: { disposition: 'owned-reference', id: OWNED_ID },
      },
    });
    expect(JSON.stringify(record)).not.toContain(FOREIGN_ID);
    expect(query.mock.calls[0][1]).toEqual([ACCOUNT_ID, null, 201]);
  });

  it('preserves Project reference nulls and only exposes IDs whose targets are owned', async () => {
    const reader = new ProfileAccountExportLegacyReader(
      ACCOUNT_ID,
      jest.fn().mockResolvedValue([projectRow()])
    );
    const [record] = await collect(reader.legacyProjectRows());
    expect(record.data).toMatchObject({
      id: MIN_ID,
      relatedProfileId: null,
      timeLineEventsId: { disposition: 'owned-reference', id: OWNED_ID },
      goalsId: { disposition: 'redacted-unowned-reference' },
    });
  });

  it('streams long Unicode fields in ordered SQL-sized chunks without losing code points', async () => {
    const description = `start-${'😀漢字'.repeat(1100)}-finish`;
    const chars = Array.from(description);
    const query = jest.fn(async (sql: string, parameters: unknown[]) => {
      if (sql.includes('substring(')) {
        const offset = Number(parameters[1]) - 1;
        const length = Number(parameters[2]);
        return [{ value: chars.slice(offset, offset + length).join('') }];
      }
      return [
        {
          ...goalRow({
            descriptionPrefix: chars.slice(0, 2501).join(''),
            descriptionChars: chars.length,
            descriptionBytes: Buffer.byteLength(description),
          }),
        },
      ];
    });
    const reader = new ProfileAccountExportLegacyReader(ACCOUNT_ID, query);
    const records = await collect(reader.legacyGoalTextRows());
    const joined = records
      .filter((record) => record.data.field === 'description')
      .sort((a, b) => Number(a.data.charOffset) - Number(b.data.charOffset));
    expect(joined.length).toBeGreaterThan(1);
    expect(joined.map((record) => record.data.value).join('')).toBe(
      description
    );
    expect(joined.map((record) => record.data.charLength)).toEqual(
      joined.map((record) => Array.from(String(record.data.value)).length)
    );
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('from $2::integer for $3::integer')
      )
    ).toBe(true);
  });

  it('includes uppercase UUID owner keys before chunk rereads and normalizes output', async () => {
    const description = `upper-${'😀漢字'.repeat(1100)}`;
    const chars = Array.from(description);
    const query = jest.fn(async (sql: string, parameters: unknown[]) => {
      if (sql.includes('substring(')) {
        const offset = Number(parameters[1]) - 1;
        const length = Number(parameters[2]);
        return [{ value: chars.slice(offset, offset + length).join('') }];
      }
      return [
        goalRow({
          userId: ACCOUNT_ID.toUpperCase(),
          descriptionPrefix: chars.slice(0, 2501).join(''),
          descriptionChars: chars.length,
          descriptionBytes: Buffer.byteLength(description),
        }),
      ];
    });
    const reader = new ProfileAccountExportLegacyReader(
      ACCOUNT_ID.toUpperCase(),
      query
    );
    const records = await collect(reader.legacyGoalTextRows());
    expect(records[0].data.accountId).toBe(ACCOUNT_ID);
    expect(records.map((record) => record.data.value).join('')).toBe(
      description
    );
    expect(String(query.mock.calls[0][0])).toContain(
      'lower(g."userId") = lower($1::varchar)'
    );
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('lower("userId") = lower($4::varchar)')
      )
    ).toBe(true);
  });

  it('rejects malformed page ordering, foreign rows and unusable query results', async () => {
    const rows = [goalRow({ id: OWNED_ID }), goalRow({ id: MIN_ID })];
    const outOfOrder = new ProfileAccountExportLegacyReader(
      ACCOUNT_ID,
      jest.fn().mockResolvedValue(rows)
    );
    await expect(collect(outOfOrder.legacyGoalRows())).rejects.toBeInstanceOf(
      ProfileAccountExportLegacyReadError
    );

    const foreignRow = new ProfileAccountExportLegacyReader(
      ACCOUNT_ID,
      jest.fn().mockResolvedValue([goalRow({ userId: FOREIGN_ID })])
    );
    await expect(collect(foreignRow.legacyGoalRows())).rejects.toBeInstanceOf(
      ProfileAccountExportLegacyReadError
    );

    const malformed = new ProfileAccountExportLegacyReader(
      ACCOUNT_ID,
      jest.fn().mockResolvedValue({ rows: [] })
    );
    await expect(collect(malformed.legacyProjectRows())).rejects.toMatchObject({
      code: 'OWNER_READ_FAILED',
    });
  });

  it('preserves parent cancellation and deadline codes from the shared transaction query', async () => {
    for (const code of ['OWNER_CAPTURE_TIMEOUT', 'OWNER_CAPTURE_ABORTED']) {
      const failure = Object.assign(new Error('capture stopped'), { code });
      const reader = new ProfileAccountExportLegacyReader(
        ACCOUNT_ID,
        jest.fn().mockRejectedValue(failure)
      );
      await expect(collect(reader.legacyGoalRows())).rejects.toBe(failure);
    }
  });

  it('fails closed when a text query returns a short PostgreSQL substring', async () => {
    const description = 'a'.repeat(3000);
    const reader = new ProfileAccountExportLegacyReader(
      ACCOUNT_ID,
      jest.fn(async (sql: string) => {
        if (sql.includes('substring(')) return [{ value: 'a'.repeat(999) }];
        return [
          goalRow({
            descriptionPrefix: description.slice(0, 2501),
            descriptionChars: description.length,
            descriptionBytes: Buffer.byteLength(description),
          }),
        ];
      })
    );
    await expect(collect(reader.legacyGoalTextRows())).rejects.toBeInstanceOf(
      ProfileAccountExportLegacyReadError
    );
  });
});
