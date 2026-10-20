import { assertNoUncoveredProfileLegacyData } from './account-export-legacy-guard';

describe('Profile legacy ownership inventory guard', () => {
  const empty = {
    ownedGoal: false,
    ownedProject: false,
    legacyTimelineLink: false,
  };

  it('permits a subject only after all three legacy predicates are empty', async () => {
    const query = jest.fn().mockResolvedValue([empty]);
    await expect(
      assertNoUncoveredProfileLegacyData('account', query)
    ).resolves.toBeUndefined();
    expect(query.mock.calls[0][1]).toEqual(['account']);
  });

  it.each(Object.keys(empty))(
    'rejects uncovered %s without returning data',
    async (field) => {
      await expect(
        assertNoUncoveredProfileLegacyData('account', async () => [
          { ...empty, [field]: true },
        ])
      ).rejects.toThrow('PROFILE_OWNER_LEGACY_DATA_UNCOVERED');
    }
  );

  it.each(
    [[], [null], [{ ownedGoal: false }], [empty, empty]].map((rows) => ({
      rows,
    }))
  )('rejects malformed inventory response %#', async ({ rows }) => {
    await expect(
      assertNoUncoveredProfileLegacyData('account', async () => rows)
    ).rejects.toThrow('PROFILE_OWNER_LEGACY_INVENTORY_UNAVAILABLE');
  });
});
